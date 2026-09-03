-- Step 1: Make sure the column exists (safe to re-run)
alter table subscription_plans
  add column if not exists price_usd_monthly integer;

-- Step 2: Backfill existing rows so nothing is null
-- If you still have price_kes_monthly data, migrate it:
-- update subscription_plans set price_usd_monthly = price_kes_monthly where price_usd_monthly is null;

-- Otherwise set sensible defaults per plan:
update subscription_plans set price_usd_monthly = 0 where key = 'free' and price_usd_monthly is null;
update subscription_plans set price_usd_monthly = 1000 where key = 'starter' and price_usd_monthly is null;
update subscription_plans set price_usd_monthly = 2500 where key = 'growth' and price_usd_monthly is null;
update subscription_plans set price_usd_monthly = 4500 where key = 'agency' and price_usd_monthly is null;

-- Step 3: Now run your full migration safely
update subscription_plans set is_active = false;

insert into subscription_plans
  (key, name, price_usd_monthly, max_clients, max_policies, max_team_members,
   max_messages_monthly, automation_enabled, bulk_import_enabled, trial_days,
   badge_tier, tagline, sort_order, is_active)
values
  ('free', 'Free', 0, 40, 25, 1, 20, true, true, 0,
   'bronze', 'Trying it out, or a small side book', 1, true),
  ('starter', 'Starter', 1000, 150, 150, 3, null, true, true, 14,
   'bronze', 'One intermediary, growing steadily', 2, true),
  ('growth', 'Growth', 2500, 1000, null, 10, null, true, true, 14,
   'silver', 'A small agency with a team', 3, true),
  ('agency', 'Agency', 4500, null, null, 25, null, true, true, 14,
   'gold', 'An established brokerage', 4, true)
on conflict (key) do update set
  name = excluded.name,
  price_usd_monthly = excluded.price_usd_monthly,
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

-- Retire anything not in the four above.
update subscription_plans
   set is_active = false
 where key not in ('free', 'starter', 'growth', 'agency');


-- Anyone left on a retired plan moves to the nearest active equivalent.
update subscriptions s
   set plan_id = (select id from subscription_plans where key = 'growth')
 where s.plan_id in (select id from subscription_plans where key in ('team', 'solo', 'business'))
   and s.status in ('active', 'trialing');
