-- Fixes the renewal reminder automation. Run after 0001-0007.
--
-- THE BUG THIS FIXES: the "Renewal follow-up 30 days before expiry" rule
-- was only ever evaluated at the moment a policy was CREATED, in
-- src/lib/automation.ts, comparing today against that policy's expiry
-- date. It asked "is today exactly 30 days before this policy ends?" --
-- which is almost never true when you add a policy, since you normally
-- add one at the start of its term, not 30 days from the end. Nothing
-- ever revisited existing policies as time actually passed toward their
-- renewal dates. So the single most valuable automation in the product,
-- and a headline reason to pay for a plan, silently did nothing for
-- real policies.
--
-- THE FIX: evaluate every active policy against its organization's
-- enabled rules once a day, server side, the same pg_cron pattern
-- already used for the subscription billing lifecycle in 0005. This is
-- the right place for it: it has to keep working whether or not anyone
-- has the app open, which client-side code fundamentally cannot do.
--
-- Also implements the 'policy_pending_documents' trigger, which was
-- seeded as a rule from day one but had no implementation anywhere --
-- turning it on previously did nothing at all.

-- Lets us tell "this task already exists for this rule + policy + date"
-- apart cheaply, so re-running the job never creates duplicates.
create index if not exists tasks_automation_dedupe_idx
  on tasks (organization_id, policy_id, created_by_automation_id, due_date);

create or replace function run_policy_automations()
returns void
language plpgsql
security definer
as $$
declare
  rule record;
  pol record;
  target_due_date date;
  new_title text;
begin
  -- ----------------------------------------------------------------
  -- policy_expiring_in_days: create a task when a policy is exactly N
  -- days from expiry, where N comes from the rule's own config.
  -- ----------------------------------------------------------------
  for rule in
    select * from automation_rules
    where enabled = true
      and trigger_type = 'policy_expiring_in_days'
      and action_task_type is not null
  loop
    for pol in
      select p.*, c.first_name, c.last_name, c.company_name
      from policies p
      join clients c on c.id = p.client_id
      where p.organization_id = rule.organization_id
        and p.status in ('active', 'expiring')
        and p.end_date = current_date + ((rule.trigger_params->>'days')::int)
    loop
      target_due_date := current_date + coalesce(rule.action_offset_days, 0);
      new_title := coalesce(rule.action_title, 'Renewal follow up') || ', policy ' || pol.policy_number;

      -- Skip if this rule already produced a task for this policy on
      -- this date (the job is safe to run more than once a day).
      if not exists (
        select 1 from tasks
        where organization_id = rule.organization_id
          and policy_id = pol.id
          and created_by_automation_id = rule.id
          and due_date = target_due_date
      ) then
        insert into tasks (organization_id, title, client_id, policy_id, task_type, due_date, priority, status, created_by_automation_id)
        values (rule.organization_id, new_title, pol.client_id, pol.id, rule.action_task_type, target_due_date, 'high', 'open', rule.id);

        insert into activities (organization_id, client_id, type, summary, related_id)
        values (rule.organization_id, pol.client_id, 'task_created', new_title, pol.id);

        insert into notifications (organization_id, type, message, related_client_id)
        values (
          rule.organization_id,
          'renewal_approaching',
          'Policy ' || pol.policy_number || ' for ' ||
            coalesce(nullif(trim(coalesce(pol.first_name, '') || ' ' || coalesce(pol.last_name, '')), ''), pol.company_name, 'a client') ||
            ' expires on ' || to_char(pol.end_date, 'DD Mon YYYY') || '.',
          pol.client_id
        );
      end if;
    end loop;
  end loop;

  -- ----------------------------------------------------------------
  -- policy_pending_documents: nag about policies still marked pending
  -- that have no documents attached, every N days. Previously seeded
  -- but never implemented.
  -- ----------------------------------------------------------------
  for rule in
    select * from automation_rules
    where enabled = true
      and trigger_type = 'policy_pending_documents'
      and action_task_type is not null
  loop
    for pol in
      select p.* from policies p
      where p.organization_id = rule.organization_id
        and p.status = 'pending'
        and not exists (
          select 1 from documents d where d.owner_type = 'policy' and d.owner_id = p.id
        )
    loop
      -- Only re-nag once every `everyDays`, based on when this rule last
      -- created a task for this policy.
      if not exists (
        select 1 from tasks
        where organization_id = rule.organization_id
          and policy_id = pol.id
          and created_by_automation_id = rule.id
          and created_at > now() - (coalesce((rule.trigger_params->>'everyDays')::int, 3) || ' days')::interval
      ) then
        new_title := coalesce(rule.action_title, 'Chase outstanding documents') || ', policy ' || pol.policy_number;
        insert into tasks (organization_id, title, client_id, policy_id, task_type, due_date, priority, status, created_by_automation_id)
        values (rule.organization_id, new_title, pol.client_id, pol.id, rule.action_task_type,
                current_date + coalesce(rule.action_offset_days, 0), 'normal', 'open', rule.id);
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Separately from the automation rules above, honour each organization's
-- own configured renewal reminder offsets (Settings, then Reminder
-- settings -- organizations.renewal_reminder_offsets, default
-- {90,60,30,14,7,3,1}). These were editable in the UI from an early
-- version but nothing ever read them, so changing them had no effect.
-- This creates a notification (not a task) at each configured offset, so
-- the two systems complement rather than duplicate each other: offsets
-- give you awareness, automation rules give you assigned work.
-- ---------------------------------------------------------------------------

create or replace function notify_policy_renewal_offsets()
returns void
language plpgsql
security definer
as $$
declare
  pol record;
begin
  for pol in
    select p.id, p.organization_id, p.client_id, p.policy_number, p.end_date,
           (p.end_date - current_date) as days_out
    from policies p
    join organizations o on o.id = p.organization_id
    where p.status in ('active', 'expiring')
      and (p.end_date - current_date) = any (o.renewal_reminder_offsets)
  loop
    if not exists (
      select 1 from notifications
      where organization_id = pol.organization_id
        and related_client_id = pol.client_id
        and type = 'policy_expiring'
        and message like '%' || pol.policy_number || '%'
        and created_at > now() - interval '20 hours'
    ) then
      insert into notifications (organization_id, type, message, related_client_id)
      values (
        pol.organization_id,
        'policy_expiring',
        'Policy ' || pol.policy_number || ' expires in ' || pol.days_out || ' day' || case when pol.days_out = 1 then '' else 's' end || '.',
        pol.client_id
      );
    end if;
  end loop;
end;
$$;

select cron.schedule('run-policy-automations', '0 5 * * *', 'select run_policy_automations();');
select cron.schedule('notify-policy-renewal-offsets', '30 5 * * *', 'select notify_policy_renewal_offsets();');
