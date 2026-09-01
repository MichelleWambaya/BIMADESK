-- Repositions the subscription plans. Run after 0001-0008.
--
-- WHY THIS CHANGES: the original structure gated automation entirely
-- behind paid tiers. But automation IS the product -- renewal reminders
-- are the specific pain an intermediary is trying to solve. A free user
-- who never sees a renewal reminder never experiences the value, so they
-- have no reason to convert; they just see a slower spreadsheet. Gating
-- the core value behind the paywall is the most common way a SaaS
-- freemium tier fails.
--
-- New shape: everyone gets automation. Tiers differentiate on scale
-- (how many clients, how many team members) and on the real marginal
-- costs of the business (SMS and WhatsApp sends cost actual money per
-- message, unlike a database row).
--
-- Also: the first paid step drops to KES 900 to make it less of a leap
-- for a solo agent, since "one person with a couple hundred clients" is
-- the most common profile in this market.

alter table subscription_plans
  add column if not exists monthly_message_allowance integer not null default 0,
  add column if not exists description text;

-- Rewrite the catalog. Existing subscriptions reference plans by id, so
-- update in place by key rather than deleting and reinserting, which
-- would orphan every current subscriber.

update subscription_plans set
  name = 'Free',
  price_kes_monthly = 0,
  max_clients = 40,
  max_team_members = 1,
  automation_enabled = true,
  monthly_message_allowance = 20,
  description = 'Try the full workflow, including renewal reminders, with a small book of business.',
  sort_order = 1
where key = 'free';

update subscription_plans set
  name = 'Solo',
  price_kes_monthly = 900,
  max_clients = 250,
  max_team_members = 1,
  automation_enabled = true,
  monthly_message_allowance = 300,
  description = 'For one intermediary running their own book full time.',
  sort_order = 2
where key = 'starter';

update subscription_plans set
  name = 'Team',
  price_kes_monthly = 2900,
  max_clients = 1200,
  max_team_members = 5,
  automation_enabled = true,
  monthly_message_allowance = 1500,
  description = 'For a small agency with staff sharing one book of business.',
  sort_order = 3
where key = 'growth';

update subscription_plans set
  name = 'Agency',
  price_kes_monthly = 6900,
  max_clients = null,
  max_team_members = 25,
  automation_enabled = true,
  monthly_message_allowance = 6000,
  description = 'Unlimited clients for an established brokerage.',
  sort_order = 4
where key = 'business';

-- ---------------------------------------------------------------------------
-- Message allowance enforcement. The send-email/send-sms/send-whatsapp
-- functions already rate limit per hour as an abuse guard; this is the
-- separate, commercial monthly quota. Exposed as functions so both the
-- Edge Functions and the UI can ask the same question and get the same
-- answer, rather than each reimplementing the rule.
-- ---------------------------------------------------------------------------

create or replace function messages_used_this_month(org_id uuid)
returns integer
language sql
security definer
stable
as $$
  select count(*)::integer from communications
  where organization_id = org_id
    and delivery_status in ('sent', 'queued')
    and channel in ('sms', 'whatsapp', 'email')
    and occurred_at >= date_trunc('month', now());
$$;

create or replace function message_allowance_remaining(org_id uuid)
returns integer
language plpgsql
security definer
stable
as $$
declare
  allowance integer;
  used integer;
  is_admin boolean;
begin
  -- Platform admins are never quota limited, matching how every other
  -- plan entitlement already treats them.
  select coalesce(bool_or(is_platform_admin), false) into is_admin
  from profiles where organization_id = org_id;
  if is_admin then return 999999; end if;

  select p.monthly_message_allowance into allowance
  from subscriptions s join subscription_plans p on p.id = s.plan_id
  where s.organization_id = org_id;

  if allowance is null then return 0; end if;

  select messages_used_this_month(org_id) into used;
  return greatest(0, allowance - used);
end;
$$;
