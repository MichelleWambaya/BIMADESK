-- Price change and yearly billing. After 0019.
--
-- Monthly:  Starter $15, Growth $25, Agency $45.
-- Yearly:   20% off every tier, billed as one payment for twelve months.
--           Starter $144, Growth $240, Agency $432.
--
-- The discount is the same on every tier on purpose. Three different
-- rates read as arbitrary, and a smaller discount on the middle tier
-- steers people away from the plan you most want them on.

alter table subscription_plans
  add column if not exists price_usd_cents_yearly integer;

update subscription_plans set price_usd_cents = 0,    price_usd_cents_yearly = 0     where key = 'free';
update subscription_plans set price_usd_cents = 1500, price_usd_cents_yearly = 14400 where key = 'starter';
update subscription_plans set price_usd_cents = 2500, price_usd_cents_yearly = 24000 where key = 'growth';
update subscription_plans set price_usd_cents = 4500, price_usd_cents_yearly = 43200 where key = 'agency';

-- ---------------------------------------------------------------------------
-- Price in shillings, for either period
-- ---------------------------------------------------------------------------

drop function if exists plan_price_kes(text);

create or replace function plan_price_kes(p_plan_key text, p_period text default 'monthly')
returns integer
language sql stable as $$
  select case
    when coalesce(
           case when p_period = 'yearly' then p.price_usd_cents_yearly else p.price_usd_cents end, 0
         ) = 0 then 0
    else (ceil(
           (case when p_period = 'yearly' then p.price_usd_cents_yearly else p.price_usd_cents end)
           * current_usd_kes_rate() / 1000000.0 / 10
         ) * 10)::integer
  end
  from subscription_plans p
  where p.key = p_plan_key;
$$;

grant execute on function plan_price_kes(text, text) to anon, authenticated;

drop function if exists public_plans();

create or replace function public_plans()
returns table (
  id uuid, key text, name text,
  price_usd_cents integer, price_kes integer,
  price_usd_cents_yearly integer, price_kes_yearly integer,
  max_clients integer, max_policies integer, max_team_members integer,
  trial_days integer, badge_tier text, tagline text, sort_order integer,
  features text[]
)
language sql stable as $$
  select sp.id, sp.key, sp.name,
         sp.price_usd_cents,        plan_price_kes(sp.key, 'monthly'),
         sp.price_usd_cents_yearly, plan_price_kes(sp.key, 'yearly'),
         sp.max_clients, sp.max_policies, sp.max_team_members,
         sp.trial_days, sp.badge_tier, sp.tagline, sp.sort_order,
         sp.features
    from subscription_plans sp
   where sp.is_active = true
   order by sp.sort_order;
$$;

grant execute on function public_plans() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Manual payments know which period was paid for, so approval extends by
-- one month or by twelve.
-- ---------------------------------------------------------------------------

alter table manual_payments
  add column if not exists billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'yearly'));

alter table subscriptions
  add column if not exists billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'yearly'));

drop function if exists submit_manual_payment(uuid, text, integer, text, date);

create or replace function submit_manual_payment(
  p_plan_id uuid,
  p_mpesa_code text,
  p_amount_claimed_kes integer,
  p_paid_from_phone text default null,
  p_paid_at date default null,
  p_billing_period text default 'monthly'
)
returns text
language plpgsql
security definer
as $$
declare
  org_id uuid;
  plan record;
  expected integer;
  clean_code text;
begin
  select organization_id into org_id from profiles where id = auth.uid();
  if org_id is null then return 'no_organization'; end if;

  if p_billing_period not in ('monthly', 'yearly') then return 'bad_period'; end if;

  clean_code := upper(regexp_replace(coalesce(p_mpesa_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(clean_code) <> 10 then return 'bad_code'; end if;

  select * into plan from subscription_plans where id = p_plan_id and is_active;
  if plan is null then return 'unknown_plan'; end if;

  expected := plan_price_kes(plan.key, p_billing_period);

  insert into manual_payments
    (organization_id, plan_id, submitted_by, mpesa_code,
     amount_claimed_kes, amount_expected_kes, paid_from_phone, paid_at, billing_period)
  values
    (org_id, p_plan_id, auth.uid(), clean_code,
     p_amount_claimed_kes, expected, p_paid_from_phone, p_paid_at, p_billing_period);

  return 'ok';
exception
  when unique_violation then
    return 'duplicate_code';
end;
$$;

grant execute on function submit_manual_payment(uuid, text, integer, text, date, text) to authenticated;

create or replace function approve_manual_payment(p_id uuid, p_note text default null)
returns text
language plpgsql
security definer
as $$
declare
  mp record;
  current_end timestamptz;
  new_end timestamptz;
  span interval;
begin
  if not is_platform_admin() then
    raise exception 'Only platform admins can approve payments';
  end if;

  select * into mp from manual_payments where id = p_id for update;
  if mp is null then return 'not_found'; end if;
  if mp.status <> 'pending' then return 'already_reviewed'; end if;

  span := case when mp.billing_period = 'yearly' then interval '12 months' else interval '1 month' end;

  select current_period_end into current_end
    from subscriptions where organization_id = mp.organization_id;

  new_end := greatest(coalesce(current_end, now()), now()) + span;

  update subscriptions set
    plan_id = mp.plan_id,
    status = 'active',
    billing_period = mp.billing_period,
    current_period_start = now(),
    current_period_end = new_end,
    trial_ends_at = null,
    read_only_since = null,
    updated_at = now()
  where organization_id = mp.organization_id;

  insert into payments
    (organization_id, plan_id, provider, amount_kes, status, provider_reference, created_at)
  values
    (mp.organization_id, mp.plan_id, 'mpesa_manual', mp.amount_claimed_kes, 'success', mp.mpesa_code, mp.created_at);

  update manual_payments set
    status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_id;

  return 'ok';
end;
$$;

grant execute on function approve_manual_payment(uuid, text) to authenticated;

-- Admin queue shows the period, since a yearly and a monthly Starter
-- payment expect very different amounts.
drop function if exists pending_manual_payments();

create or replace function pending_manual_payments()
returns table (
  id uuid, organization_name text, plan_name text, billing_period text, mpesa_code text,
  amount_claimed_kes integer, amount_expected_kes integer,
  paid_from_phone text, paid_at date, submitted_by_name text, created_at timestamptz
)
language sql security definer stable as $$
  select mp.id, o.name, p.name, mp.billing_period, mp.mpesa_code,
         mp.amount_claimed_kes, mp.amount_expected_kes,
         mp.paid_from_phone, mp.paid_at, pr.full_name, mp.created_at
    from manual_payments mp
    join organizations o on o.id = mp.organization_id
    join subscription_plans p on p.id = mp.plan_id
    left join profiles pr on pr.id = mp.submitted_by
   where mp.status = 'pending' and is_platform_admin()
   order by mp.created_at;
$$;

grant execute on function pending_manual_payments() to authenticated;
