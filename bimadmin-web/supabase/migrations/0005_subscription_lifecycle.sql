-- Adds automatic subscription lifecycle handling on top of 0001-0004.
--
-- IMPORTANT: this is the one piece of this app that could not be tested
-- against a real database at all -- there has never been a live
-- Supabase project available while building this. pg_cron scheduling in
-- particular is worth confirming actually fires before relying on it:
-- after running this migration, check Database, then Cron Jobs in your
-- Supabase dashboard, and watch the `expire-stale-subscriptions` and
-- `notify-upcoming-renewals` jobs run once before trusting them.
--
-- What this does, and what it deliberately does not do:
--   - It cannot auto-charge M-Pesa. Safaricom's standard STK push API has
--     no "charge this customer again without them approving on their
--     phone" capability, so there is no such thing as silent recurring
--     M-Pesa billing here. What this DOES do is remind the organization
--     before renewal is due, give a grace period after it lapses, and
--     downgrade to Free automatically if nobody pays -- the realistic
--     version of "recurring billing" for a payment method that requires
--     active approval every time.
--   - Card payments via Paystack COULD support real recurring billing
--     (charging a saved authorization without the customer re-entering
--     card details), but that is not wired up here; this migration only
--     handles the reminder/grace/downgrade lifecycle for both payment
--     methods equally.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Reminds an organization a few days before their paid plan renews,
-- once per renewal cycle (not once per day the cron job happens to run).
-- ---------------------------------------------------------------------------

create or replace function notify_upcoming_renewals()
returns void
language plpgsql
security definer
as $$
declare
  sub record;
  free_plan_id uuid;
begin
  select id into free_plan_id from subscription_plans where key = 'free';

  for sub in
    select s.* from subscriptions s
    where s.status = 'active'
      and s.plan_id <> free_plan_id
      and s.current_period_end is not null
      and s.current_period_end between now() and now() + interval '3 days'
  loop
    if not exists (
      select 1 from notifications
      where organization_id = sub.organization_id
        and type = 'renewal_approaching'
        and created_at > now() - interval '3 days'
    ) then
      insert into notifications (organization_id, type, message)
      values (sub.organization_id, 'renewal_approaching', 'Your BimAdmin subscription renews in the next few days. Pay from Billing to keep your current plan.');
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Runs daily. Marks a lapsed paid subscription as past_due for a short
-- grace period, then downgrades to Free if it's still unpaid after that.
-- ---------------------------------------------------------------------------

create or replace function expire_stale_subscriptions()
returns void
language plpgsql
security definer
as $$
declare
  sub record;
  free_plan_id uuid;
  grace_period interval := interval '3 days';
begin
  select id into free_plan_id from subscription_plans where key = 'free';

  -- Just lapsed, inside the grace period: flag as past_due once.
  for sub in
    select * from subscriptions
    where status = 'active'
      and plan_id <> free_plan_id
      and current_period_end is not null
      and current_period_end < now()
      and current_period_end >= now() - grace_period
  loop
    update subscriptions set status = 'past_due', updated_at = now() where id = sub.id;
    insert into notifications (organization_id, type, message)
    values (sub.organization_id, 'renewal_approaching', 'Your BimAdmin subscription payment did not go through. Pay within a few days to avoid losing access to paid features.');
  end loop;

  -- Past the grace period: downgrade to Free rather than leaving the
  -- organization stuck in limbo indefinitely.
  for sub in
    select * from subscriptions
    where status = 'past_due'
      and plan_id <> free_plan_id
      and current_period_end is not null
      and current_period_end < now() - grace_period
  loop
    update subscriptions set plan_id = free_plan_id, status = 'active', updated_at = now() where id = sub.id;
    insert into notifications (organization_id, type, message)
    values (sub.organization_id, 'renewal_approaching', 'Your BimAdmin subscription moved to the Free plan after payment did not go through. Upgrade any time from Billing.');
  end loop;
end;
$$;

select cron.schedule('notify-upcoming-renewals', '0 6 * * *', 'select notify_upcoming_renewals();');
select cron.schedule('expire-stale-subscriptions', '0 3 * * *', 'select expire_stale_subscriptions();');
