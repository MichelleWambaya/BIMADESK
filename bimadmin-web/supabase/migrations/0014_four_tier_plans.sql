-- Four tiers: Free, Starter, Growth, Agency. Run after 0013.
--
-- Changes from 0012:
--   * New Starter tier at KES 499, for a solo intermediary who has
--     outgrown Free but is not ready for KES 1,500.
--   * Growth and Agency get unlimited messaging (max_messages_monthly
--     null), so the message allowance stops being a thing paying
--     customers have to think about.
--   * Agency is unlimited on every axis.
--   * Seat counts: Starter 1, Growth 10, Agency unlimited.
--
-- BADGES. Four tiers, three colours, so the crown is what separates Free
-- from Starter rather than a fourth colour:
--
--   Free      bronze ring, NO crown
--   Starter   bronze ring, crown
--   Growth    silver ring, crown
--   Agency    gold ring,   crown
--
-- This keeps the original bronze/silver/gold mapping intact and means the
-- crown reads as "this person pays", which is the distinction that
-- actually matters.

-- max_team_members was NOT NULL with a default of 1 in 0001, but Agency
-- needs null to mean unlimited, consistent with every other cap. This has
-- to happen BEFORE the insert below, which writes null into that column.
alter table subscription_plans alter column max_team_members drop not null;
alter table subscription_plans alter column max_team_members drop default;

-- The policy ladder is the main conversion lever, so it tightens
-- deliberately: Free 25, Starter 150, then unlimited. Lifting the policy
-- cap to unlimited at Starter would remove the reason to move to Growth.

insert into subscription_plans
  (key, name, price_kes_monthly, max_clients, max_policies, max_team_members,
   max_messages_monthly, automation_enabled, bulk_import_enabled, trial_days,
   badge_tier, tagline, sort_order, is_active)
values
  ('free', 'Free', 0, 40, 25, 1, 20, true, true, 0,
   'bronze', 'Trying it out, or a small side book', 1, true),

  ('starter', 'Starter', 499, 150, 150, 1, 500, true, true, 14,
   'bronze', 'One intermediary, growing steadily', 2, true),

  ('growth', 'Growth', 1500, 1000, null, 10, null, true, true, 14,
   'silver', 'A small agency with a team', 3, true),

  ('agency', 'Agency', 4900, null, null, null, null, true, true, 14,
   'gold', 'An established brokerage, everything unlimited', 4, true)

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

-- Retire anything not in the four above.
update subscription_plans
   set is_active = false
 where key not in ('free', 'starter', 'growth', 'agency');


-- Anyone left on a retired plan moves to the nearest active equivalent.
update subscriptions s
   set plan_id = (select id from subscription_plans where key = 'growth')
 where s.plan_id in (select id from subscription_plans where key in ('team', 'solo', 'business'))
   and s.status in ('active', 'trialing');
