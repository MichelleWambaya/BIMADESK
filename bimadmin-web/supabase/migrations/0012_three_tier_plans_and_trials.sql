-- Consolidates four plans into three, adds trials, policy limits, and an
-- access state machine. Run after 0001-0011.
--
-- WHY THREE TIERS: four options is where choice paralysis starts, and the
-- old Solo (KES 900, 1 seat) to Team (KES 2,900, 5 seats) jump was steep
-- enough that a growing solo intermediary had nothing sensible to move
-- to. Three tiers also matches the badge design: bronze, silver, gold.

alter table subscription_plans
  add column if not exists max_policies integer,
  add column if not exists trial_days integer not null default 0,
  add column if not exists badge_tier text not null default 'bronze'
    check (badge_tier in ('bronze', 'silver', 'gold')),
  add column if not exists tagline text,
  add column if not exists is_active boolean not null default true;

alter table subscription_plans
  add column if not exists max_messages_monthly integer;

-- ---------------------------------------------------------------------------
-- The three tiers.
--
-- Free is capped rather than time limited. A one year timer on Free means
-- someone who never intended to pay loses access to their client book on
-- a date they did not choose, which produces angry ex-users rather than
-- customers. A tight policy cap does the converting instead: it bites
-- exactly when the person is getting real value and has something to
-- lose, which is the moment they will actually pay.
-- ---------------------------------------------------------------------------

update subscription_plans set is_active = false;

insert into subscription_plans
  (key, name, price_kes_monthly, max_clients, max_policies, max_team_members,
   max_messages_monthly, automation_enabled, bulk_import_enabled, trial_days,
   badge_tier, tagline, sort_order, is_active)
values
  ('free', 'Free', 0, 40, 25, 1, 20, true, true, 0,
   'bronze', 'Trying it out, or a small side book', 1, true),
  ('growth', 'Growth', 1500, 400, null, 3, 600, true, true, 14,
   'silver', 'One intermediary, full time', 2, true),
  ('agency', 'Agency', 4900, null, null, 15, 2500, true, true, 14,
   'gold', 'An established brokerage with staff', 3, true)
on conflict (key) do update set
  name = excluded.name,
  price_kes_monthly = excluded.price_kes_monthly,
  max_clients = excluded.max_clients,
  max_policies = excluded.max_policies,
  max_team_members = excluded.max_team_members,
  max_messages_monthly = excluded.max_messages_monthly,
  automation_enabled = excluded.automation_enabled,
  bulk_import_enabled = excluded.bulk_import_enabled,
  trial_days = excluded.trial_days,
  badge_tier = excluded.badge_tier,
  tagline = excluded.tagline,
  sort_order = excluded.sort_order,
  is_active = true;

-- Move anyone on a retired plan to the nearest active one, so nobody is
-- left pointing at a plan that no longer appears anywhere.
update subscriptions s set plan_id = (select id from subscription_plans where key = 'growth')
where s.plan_id in (select id from subscription_plans where key in ('starter'))
  and s.status in ('active', 'trialing');

update subscriptions s set plan_id = (select id from subscription_plans where key = 'agency')
where s.plan_id in (select id from subscription_plans where key in ('business', 'team'))
  and s.status in ('active', 'trialing');

-- ---------------------------------------------------------------------------
-- Trials and access state
-- ---------------------------------------------------------------------------

alter table subscriptions
  add column if not exists trial_ends_at timestamptz,
  add column if not exists read_only_since timestamptz;

alter table subscriptions drop constraint if exists subscriptions_status_check;
alter table subscriptions add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'read_only', 'canceled'));

/**
 * The access state for an organization. Three states rather than a
 * boolean, because "can they get in" and "can they change things" are
 * different questions.
 *
 *   full      -- everything works
 *   read_only -- can view and export, cannot create or send
 *   blocked   -- only billing is reachable
 *
 * DELIBERATE CHOICE: an expired subscription lands on read_only, not
 * blocked. Locking an intermediary out of their own client records is
 * worse than it looks. They have regulatory record keeping duties, so a
 * hard lock can put them in breach of their obligations through no fault
 * of their own, and under the Data Protection Act 2019 withholding a
 * controller's own records invites a complaint. It is also the single
 * most reliable way to turn a late payer into someone who tells other
 * intermediaries not to use you. Read only keeps the commercial pressure
 * (they cannot actually work) without holding data hostage.
 */
create or replace function organization_access_state(org_id uuid)
returns text
language plpgsql
security definer
stable
as $$
declare
  sub record;
  plan record;
begin
  select * into sub from subscriptions
   where organization_id = org_id
   order by created_at desc limit 1;

  if sub is null then
    return 'full';
  end if;

  select * into plan from subscription_plans where id = sub.plan_id;

  -- Free is never restricted by time. Its caps do the work.
  if plan.price_kes_monthly = 0 then
    return 'full';
  end if;

  if sub.status = 'trialing' then
    if sub.trial_ends_at is not null and sub.trial_ends_at < now() then
      return 'read_only';
    end if;
    return 'full';
  end if;

  if sub.status = 'active' then
    -- A short grace period after the period ends, so a payment that is
    -- a day late does not interrupt someone's working morning.
    if sub.current_period_end is not null and sub.current_period_end + interval '3 days' < now() then
      return 'read_only';
    end if;
    return 'full';
  end if;

  if sub.status in ('past_due', 'read_only') then
    return 'read_only';
  end if;

  if sub.status = 'canceled' then
    -- Canceled subscriptions stay readable for 30 days so people can get
    -- their data out, then only billing remains reachable.
    if sub.read_only_since is not null and sub.read_only_since + interval '30 days' < now() then
      return 'blocked';
    end if;
    return 'read_only';
  end if;

  return 'full';
end;
$$;

grant execute on function organization_access_state(uuid) to authenticated;

/** Convenience wrapper for the caller's own organization. */
create or replace function my_access_state()
returns text
language sql
security definer
stable
as $$
  select organization_access_state(
    (select organization_id from profiles where id = auth.uid())
  );
$$;

grant execute on function my_access_state() to authenticated;

-- ---------------------------------------------------------------------------
-- Usage counts, so the UI can show "18 of 25 policies" without pulling
-- every row down to the client.
-- ---------------------------------------------------------------------------

create or replace function my_usage()
returns table (
  clients_used integer,
  policies_used integer,
  seats_used integer,
  messages_used_this_month integer,
  max_clients integer,
  max_policies integer,
  max_team_members integer,
  max_messages_monthly integer,
  plan_key text,
  plan_name text,
  badge_tier text,
  access_state text
)
language sql
security definer
stable
as $$
  with me as (select organization_id from profiles where id = auth.uid()),
  sub as (
    select s.* from subscriptions s, me
     where s.organization_id = me.organization_id
     order by s.created_at desc limit 1
  ),
  plan as (select p.* from subscription_plans p, sub where p.id = sub.plan_id)
  select
    (select count(*)::integer from clients c, me where c.organization_id = me.organization_id),
    (select count(*)::integer from policies p, me where p.organization_id = me.organization_id),
    (select count(*)::integer from profiles pr, me where pr.organization_id = me.organization_id),
    (select count(*)::integer from communications cm, me
      where cm.organization_id = me.organization_id
        and cm.channel in ('sms', 'whatsapp', 'email')
        and cm.occurred_at >= date_trunc('month', now())),
    (select plan.max_clients from plan),
    (select plan.max_policies from plan),
    (select plan.max_team_members from plan),
    (select plan.max_messages_monthly from plan),
    (select plan.key from plan),
    (select plan.name from plan),
    (select plan.badge_tier from plan),
    (select my_access_state());
$$;

grant execute on function my_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- Enforce the policy cap in the database, not just the interface.
-- A limit that only exists in the frontend is not a limit.
-- ---------------------------------------------------------------------------

create or replace function enforce_policy_limit()
returns trigger
language plpgsql
as $$
declare
  cap integer;
  used integer;
begin
  select p.max_policies into cap
    from subscriptions s
    join subscription_plans p on p.id = s.plan_id
   where s.organization_id = new.organization_id
   order by s.created_at desc limit 1;

  if cap is null then
    return new;
  end if;

  select count(*) into used from policies where organization_id = new.organization_id;

  if used >= cap then
    raise exception 'POLICY_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists policies_enforce_limit on policies;
create trigger policies_enforce_limit
  before insert on policies
  for each row execute function enforce_policy_limit();

-- Public plan listing for the landing page, so marketing and billing can
-- never disagree about prices again.
create or replace function public_plans()
returns table (
  key text,
  name text,
  price_kes_monthly integer,
  max_clients integer,
  max_policies integer,
  max_team_members integer,
  max_messages_monthly integer,
  trial_days integer,
  badge_tier text,
  tagline text,
  sort_order integer
)
language sql
stable
as $$
  select sp.key, sp.name, sp.price_kes_monthly, sp.max_clients, sp.max_policies,
         sp.max_team_members, sp.max_messages_monthly, sp.trial_days, sp.badge_tier,
         sp.tagline, sp.sort_order
    from subscription_plans sp
   where sp.is_active = true
   order by sp.sort_order;
$$;

grant execute on function public_plans() to anon, authenticated;

/** Starts a trial. Called when someone picks a paid plan without paying
 * yet. Idempotent: an organization only ever gets one trial, so this
 * cannot be farmed by switching plans back and forth. */
create or replace function start_trial(target_plan_key text)
returns text
language plpgsql
security definer
as $$
declare
  org_id uuid;
  plan record;
  already boolean;
begin
  select organization_id into org_id from profiles where id = auth.uid();
  if org_id is null then return 'no_organization'; end if;

  select * into plan from subscription_plans where key = target_plan_key and is_active;
  if plan is null then return 'unknown_plan'; end if;
  if plan.trial_days <= 0 then return 'no_trial_available'; end if;

  select exists (
    select 1 from subscriptions
     where organization_id = org_id and trial_ends_at is not null
  ) into already;
  if already then return 'trial_already_used'; end if;

  update subscriptions set
    plan_id = plan.id,
    status = 'trialing',
    trial_ends_at = now() + (plan.trial_days || ' days')::interval,
    updated_at = now()
  where organization_id = org_id;

  return 'ok';
end;
$$;

grant execute on function start_trial(text) to authenticated;

-- Daily job: move expired trials and lapsed subscriptions to read_only.
create or replace function expire_trials_and_lapsed()
returns void
language plpgsql
security definer
as $$
begin
  update subscriptions set status = 'read_only', read_only_since = now(), updated_at = now()
   where status = 'trialing' and trial_ends_at is not null and trial_ends_at < now();

  update subscriptions set status = 'read_only', read_only_since = now(), updated_at = now()
   where status = 'active'
     and current_period_end is not null
     and current_period_end + interval '3 days' < now()
     and plan_id in (select id from subscription_plans where price_kes_monthly > 0);
end;
$$;

select cron.schedule(
  'expire-trials-and-lapsed',
  '20 2 * * *',
  $$select expire_trials_and_lapsed();$$
);
