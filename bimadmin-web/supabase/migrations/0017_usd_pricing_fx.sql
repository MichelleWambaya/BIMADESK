-- USD pricing, with KES conversion at charge time. After 0016.
--
-- Plans are priced and displayed in USD. M-Pesa only moves shillings, so
-- a rate is applied server side at the moment of charge.
--
-- THE RULE THAT MATTERS: the rate used for a charge is written onto the
-- payment row. Recomputing "what was this worth" later from today's rate
-- gives a different answer every time you run the report, which makes
-- reconciliation against an M-Pesa statement impossible. The rate is part
-- of the transaction, not a lookup.

alter table subscription_plans
  add column if not exists price_usd_cents integer;

-- $25 / $45 / $75. Stored in cents so no float ever touches a price.
update subscription_plans set price_usd_cents = 0    where key = 'free';
update subscription_plans set price_usd_cents = 2500 where key = 'starter';
update subscription_plans set price_usd_cents = 4500 where key = 'growth';
update subscription_plans set price_usd_cents = 7500 where key = 'agency';

-- ---------------------------------------------------------------------------
-- FX rates
--
-- Held as rows with a validity window rather than a single mutable value,
-- so a payment taken last month can still be explained with the rate that
-- was actually in force then.
-- ---------------------------------------------------------------------------

create table fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null default 'USD',
  quote_currency text not null default 'KES',
  -- Shillings per dollar, scaled by 10000. 129.4500 is stored as 1294500.
  -- Integer arithmetic throughout: a rate as a float turns a $25 charge
  -- into 3236.2499999999995 shillings and the rounding drifts.
  rate_scaled bigint not null,
  -- Buffer over the market rate, in basis points. Covers the gap between
  -- quoting and settling, plus whatever the aggregator takes on
  -- conversion. Without it every charge is very slightly short.
  margin_bp integer not null default 250,
  source text,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index fx_rates_lookup_idx on fx_rates(base_currency, quote_currency, effective_from desc);

alter table fx_rates enable row level security;
create policy fx_readable on fx_rates for select using (true);

-- Seed. REPLACE THIS before taking real money: it is a placeholder, and a
-- stale rate silently undercharges every customer.
insert into fx_rates (rate_scaled, margin_bp, source)
values (1290000, 250, 'placeholder, replace before launch');

/** The rate in force now, margin included. */
create or replace function current_usd_kes_rate()
returns bigint
language sql stable as $$
  select round(rate_scaled * (10000 + margin_bp) / 10000.0)::bigint
    from fx_rates
   where base_currency = 'USD' and quote_currency = 'KES'
     and effective_from <= now()
   order by effective_from desc
   limit 1;
$$;

grant execute on function current_usd_kes_rate() to anon, authenticated;

/**
 * What a plan costs in whole shillings right now.
 *
 * Rounded UP to the nearest 10 shillings. Two reasons: M-Pesa cannot
 * charge fractional shillings, and an amount like "KES 3,237" looks like
 * a mistake to the person approving it on their handset, which costs you
 * completions. KES 3,240 reads as a price.
 */
create or replace function plan_price_kes(p_plan_key text)
returns integer
language sql stable as $$
  select case
    when p.price_usd_cents = 0 then 0
    else (ceil(p.price_usd_cents * current_usd_kes_rate() / 1000000.0 / 10) * 10)::integer
  end
  from subscription_plans p
  where p.key = p_plan_key;
$$;

grant execute on function plan_price_kes(text) to anon, authenticated;

-- Public plan listing, now carrying both currencies so the interface can
-- show the dollar price and the shilling amount that will actually be
-- charged, side by side. Quoting only USD and then debiting shillings is
-- how you get disputes.
create or replace function public_plans()
returns table (
  key text, name text,
  price_usd_cents integer, price_kes integer,
  max_clients integer, max_policies integer, max_team_members integer,
  max_messages_monthly integer, included_sms_monthly integer,
  trial_days integer, badge_tier text, tagline text, sort_order integer
)
language sql stable as $$
  select sp.key, sp.name,
         sp.price_usd_cents,
         plan_price_kes(sp.key),
         sp.max_clients, sp.max_policies, sp.max_team_members,
         sp.max_messages_monthly, sp.included_sms_monthly,
         sp.trial_days, sp.badge_tier, sp.tagline, sp.sort_order
    from subscription_plans sp
   where sp.is_active = true
   order by sp.sort_order;
$$;

grant execute on function public_plans() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payments record what was charged, in both currencies, at that rate.
-- ---------------------------------------------------------------------------

alter table payments
  add column if not exists amount_usd_cents integer,
  add column if not exists fx_rate_scaled bigint,
  add column if not exists fx_margin_bp integer;

/** Snapshots the conversion onto a payment before it is sent to M-Pesa.
 *  Returns the shilling amount to charge. */
create or replace function quote_payment_in_kes(p_payment_id uuid, p_plan_key text)
returns integer
language plpgsql security definer as $$
declare
  usd_cents integer;
  rate bigint;
  margin integer;
  kes integer;
begin
  select price_usd_cents into usd_cents from subscription_plans where key = p_plan_key;
  if usd_cents is null then raise exception 'Unknown plan %', p_plan_key; end if;

  select rate_scaled, margin_bp into rate, margin
    from fx_rates
   where base_currency = 'USD' and quote_currency = 'KES' and effective_from <= now()
   order by effective_from desc limit 1;

  kes := plan_price_kes(p_plan_key);

  update payments set
    amount_usd_cents = usd_cents,
    amount_kes = kes,
    fx_rate_scaled = rate,
    fx_margin_bp = margin
  where id = p_payment_id;

  return kes;
end;
$$;

grant execute on function quote_payment_in_kes(uuid, text) to authenticated, service_role;
