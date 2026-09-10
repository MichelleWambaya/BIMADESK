-- Tier perks. After 0018.
--
-- Prices are unchanged. What changes is what each tier unlocks.
--
-- The old tiers differed only by caps: more clients, more policies, more
-- seats. Caps are a reason to upgrade only once you hit them, which for
-- most people is months away, so there was nothing to want NOW. This
-- attaches capabilities to tiers instead, and every one of them already
-- exists in the product; nothing here is a promise to build something.
--
-- Messaging is deliberately absent from every tier while WhatsApp and SMS
-- are switched off.

alter table subscription_plans
  add column if not exists features text[] not null default '{}';

-- Feature keys, and the tier where each unlocks. The interface reads these
-- to gate screens and to render the pricing table, so the two can never
-- disagree.
--
--   renewal_reminders      email reminders and the daily renewal check
--   member_schedules       dependants, families, corporate member lists
--   kyc_checklists         per client type document checklist
--   document_storage       upload and store policy documents
--   promise_to_pay         payment commitments with follow up
--   commission_tracking    earned, received, owed
--   rejection_workflow     bounced, incomplete, KYC failed, with tasks
--   age_out_alerts         children approaching the cover age limit
--   full_history           activity and communication history past 90 days
--   duplicate_merge        merge duplicate client records
--   custom_kyc             edit the KYC checklist per client type
--   team_attribution       who did what, per teammate
--   priority_support       same day response
--   bulk_import            CSV, Excel, PDF, Word import

update subscription_plans set features = array[
  'renewal_reminders',
  'bulk_import'
] where key = 'free';

update subscription_plans set features = array[
  'renewal_reminders',
  'bulk_import',
  'member_schedules',
  'kyc_checklists',
  'document_storage',
  'promise_to_pay',
  'full_history'
] where key = 'starter';

update subscription_plans set features = array[
  'renewal_reminders',
  'bulk_import',
  'member_schedules',
  'kyc_checklists',
  'document_storage',
  'promise_to_pay',
  'full_history',
  'commission_tracking',
  'rejection_workflow',
  'age_out_alerts',
  'priority_support'
] where key = 'growth';

update subscription_plans set features = array[
  'renewal_reminders',
  'bulk_import',
  'member_schedules',
  'kyc_checklists',
  'document_storage',
  'promise_to_pay',
  'full_history',
  'commission_tracking',
  'rejection_workflow',
  'age_out_alerts',
  'priority_support',
  'duplicate_merge',
  'custom_kyc',
  'team_attribution'
] where key = 'agency';

-- Taglines that say who each tier is for, in one line.
update subscription_plans set tagline = 'Keep your renewals in one place'              where key = 'free';
update subscription_plans set tagline = 'Run a real book, not a spreadsheet'          where key = 'starter';
update subscription_plans set tagline = 'Know what every policy earns you'            where key = 'growth';
update subscription_plans set tagline = 'Everything, for a team that shares one book' where key = 'agency';

-- Free keeps 90 days of history. Enough to see the product working, short
-- enough that a book with real activity feels the ceiling within a quarter.
insert into platform_settings (key, value_int) values ('free_history_days', 90)
on conflict (key) do nothing;

create or replace function public_plans()
returns table (
  id uuid, key text, name text,
  price_usd_cents integer, price_kes integer,
  max_clients integer, max_policies integer, max_team_members integer,
  trial_days integer, badge_tier text, tagline text, sort_order integer,
  features text[]
)
language sql stable as $$
  select sp.id, sp.key, sp.name,
         sp.price_usd_cents,
         plan_price_kes(sp.key),
         sp.max_clients, sp.max_policies, sp.max_team_members,
         sp.trial_days, sp.badge_tier, sp.tagline, sp.sort_order,
         sp.features
    from subscription_plans sp
   where sp.is_active = true
   order by sp.sort_order;
$$;

grant execute on function public_plans() to anon, authenticated;
