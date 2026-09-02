-- Packages restructured, message wallet, own SMS gateway, promise to pay.
-- Run after 0014.
--
-- The change that matters: messages are no longer bundled into the
-- subscription beyond a small allowance. Software has no marginal cost;
-- SMS and WhatsApp do. Selling both at one flat price meant a heavy user
-- cost more than they paid, with no ceiling.

-- ---------------------------------------------------------------------------
-- 1. Packages
--
-- Prices unchanged. What changes is that the included allowance is small
-- and covers SMS and email ONLY. WhatsApp always draws on the wallet,
-- because Meta bills per conversation at roughly eight times an SMS and
-- it was that single line item that made every tier unprofitable.
-- ---------------------------------------------------------------------------

alter table subscription_plans
  add column if not exists included_sms_monthly integer not null default 0,
  add column if not exists allows_own_gateway boolean not null default false;

insert into subscription_plans
  (key, name, price_kes_monthly, max_clients, max_policies, max_team_members,
   max_messages_monthly, included_sms_monthly, allows_own_gateway,
   automation_enabled, bulk_import_enabled, trial_days, badge_tier, tagline,
   sort_order, is_active)
values
  ('free',    'Free',    0,    40,   25,   1,    null, 20,   false, true, true, 0,  'bronze', 'Trying it out, or a small side book',        1, true),
  ('starter', 'Starter', 499,  150,  150,  3,    null, 100,  false, true, true, 14, 'bronze', 'One intermediary, growing steadily',        2, true),
  ('growth',  'Growth',  1500, 1000, null, 10,   null, 400,  true,  true, true, 14, 'silver', 'A small agency with a team',                3, true),
  ('agency',  'Agency',  4900, null, null, 25,   null, 1500, true,  true, true, 14, 'gold',   'An established brokerage',                  4, true)
on conflict (key) do update set
  name = excluded.name,
  price_kes_monthly = excluded.price_kes_monthly,
  max_clients = excluded.max_clients,
  max_policies = excluded.max_policies,
  max_team_members = excluded.max_team_members,
  max_messages_monthly = excluded.max_messages_monthly,
  included_sms_monthly = excluded.included_sms_monthly,
  allows_own_gateway = excluded.allows_own_gateway,
  trial_days = excluded.trial_days,
  badge_tier = excluded.badge_tier,
  tagline = excluded.tagline,
  sort_order = excluded.sort_order,
  is_active = true;

-- ---------------------------------------------------------------------------
-- 2. Prepaid message wallet
--
-- Balance is held in cents to avoid float drift, and every movement is a
-- ledger row rather than an update to a running total. A bare balance
-- column would leave you unable to answer "where did my credit go", which
-- is the first thing a customer asks.
-- ---------------------------------------------------------------------------

create table message_wallets (
  organization_id uuid primary key references organizations(id) on delete cascade,
  balance_cents bigint not null default 0,
  low_balance_threshold_cents bigint not null default 20000,  -- KES 200
  auto_topup_enabled boolean not null default false,
  auto_topup_amount_cents bigint,
  updated_at timestamptz not null default now()
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  amount_cents bigint not null,          -- positive credit, negative debit
  balance_after_cents bigint not null,
  kind text not null check (kind in ('topup', 'message_charge', 'refund', 'adjustment', 'included_allowance')),
  channel text check (channel in ('sms', 'whatsapp', 'email')),
  quantity integer,
  communication_id uuid references communications(id) on delete set null,
  payment_id uuid references payments(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index wallet_transactions_org_idx on wallet_transactions(organization_id, created_at desc);

-- Retail rates, in cents. Held as data so a price change is one update.
create table message_rates (
  channel text primary key,
  price_cents integer not null,
  updated_at timestamptz not null default now()
);

insert into message_rates (channel, price_cents) values
  ('sms', 150),        -- KES 1.50
  ('whatsapp', 800),   -- KES 8.00
  ('email', 0)
on conflict (channel) do nothing;

alter table message_wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table message_rates enable row level security;

create policy wallets_own on message_wallets for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy wallet_tx_own on wallet_transactions for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy rates_readable on message_rates for select using (true);

/**
 * Charges the wallet for one message, or consumes the monthly included
 * allowance first.
 *
 * Returns 'ok', 'insufficient_funds', or 'no_wallet'. Called by the send
 * functions BEFORE dispatching, so a message is never sent that cannot be
 * paid for. Doing it after would mean eating the cost on every failure.
 */
create or replace function charge_for_message(
  p_org_id uuid,
  p_channel text,
  p_communication_id uuid default null
)
returns text
language plpgsql
security definer
as $$
declare
  rate integer;
  allowance integer;
  used_this_month integer;
  wallet record;
  new_balance bigint;
begin
  select price_cents into rate from message_rates where channel = p_channel;
  if rate is null then return 'unknown_channel'; end if;

  -- Email is free, so log nothing and return.
  if rate = 0 then return 'ok'; end if;

  -- The included allowance covers SMS only. WhatsApp always costs, since
  -- bundling it is what made the old plans lose money.
  if p_channel = 'sms' then
    select p.included_sms_monthly into allowance
      from subscriptions s
      join subscription_plans p on p.id = s.plan_id
     where s.organization_id = p_org_id
     order by s.created_at desc limit 1;

    select count(*) into used_this_month
      from wallet_transactions
     where organization_id = p_org_id
       and kind = 'included_allowance'
       and channel = 'sms'
       and created_at >= date_trunc('month', now());

    if coalesce(allowance, 0) > used_this_month then
      insert into wallet_transactions
        (organization_id, amount_cents, balance_after_cents, kind, channel, quantity, communication_id, note)
      values
        (p_org_id, 0,
         coalesce((select balance_cents from message_wallets where organization_id = p_org_id), 0),
         'included_allowance', 'sms', 1, p_communication_id, 'Covered by monthly allowance');
      return 'ok';
    end if;
  end if;

  select * into wallet from message_wallets where organization_id = p_org_id for update;
  if wallet is null then
    insert into message_wallets (organization_id) values (p_org_id)
    on conflict (organization_id) do nothing;
    select * into wallet from message_wallets where organization_id = p_org_id for update;
  end if;

  if wallet.balance_cents < rate then
    return 'insufficient_funds';
  end if;

  new_balance := wallet.balance_cents - rate;

  update message_wallets
     set balance_cents = new_balance, updated_at = now()
   where organization_id = p_org_id;

  insert into wallet_transactions
    (organization_id, amount_cents, balance_after_cents, kind, channel, quantity, communication_id)
  values
    (p_org_id, -rate, new_balance, 'message_charge', p_channel, 1, p_communication_id);

  return 'ok';
end;
$$;

grant execute on function charge_for_message(uuid, text, uuid) to authenticated, service_role;

/** Credits the wallet after a successful top-up payment. */
create or replace function credit_wallet(
  p_org_id uuid,
  p_amount_cents bigint,
  p_payment_id uuid default null,
  p_note text default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  new_balance bigint;
begin
  insert into message_wallets (organization_id, balance_cents)
  values (p_org_id, p_amount_cents)
  on conflict (organization_id) do update
    set balance_cents = message_wallets.balance_cents + p_amount_cents,
        updated_at = now()
  returning balance_cents into new_balance;

  insert into wallet_transactions
    (organization_id, amount_cents, balance_after_cents, kind, payment_id, note)
  values
    (p_org_id, p_amount_cents, new_balance, 'topup', p_payment_id, p_note);

  return new_balance;
end;
$$;

grant execute on function credit_wallet(uuid, bigint, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Bring your own SMS gateway (Africa's Talking)
--
-- An intermediary who connects their own account pays their own SMS bill
-- and, more importantly to them, sends from their own registered sender
-- ID so clients see the broker's name rather than a shared shortcode.
--
-- The API key is write-only from the client's perspective: it is stored
-- here but never returned by any read path. `has_api_key` tells the UI
-- whether one is saved without ever shipping the secret back to a browser.
-- ---------------------------------------------------------------------------

create table sms_gateways (
  organization_id uuid primary key references organizations(id) on delete cascade,
  provider text not null default 'africastalking' check (provider in ('africastalking')),
  username text not null,
  api_key text not null,
  sender_id text,
  is_active boolean not null default false,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sms_gateways enable row level security;

-- Deliberately NO select policy for normal users. Nothing in the app
-- needs to read the key back; the edge function uses the service role.
create policy gateways_write_own on sms_gateways for insert
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy gateways_update_own on sms_gateways for update
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy gateways_delete_own on sms_gateways for delete
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

/** Non-secret view of the gateway config, safe to send to a browser. */
create or replace function my_sms_gateway()
returns table (provider text, username text, sender_id text, is_active boolean,
               has_api_key boolean, last_verified_at timestamptz, last_error text)
language sql
security definer
stable
as $$
  select g.provider, g.username, g.sender_id, g.is_active,
         g.api_key is not null and length(g.api_key) > 0,
         g.last_verified_at, g.last_error
    from sms_gateways g
   where g.organization_id = (select organization_id from profiles where id = auth.uid());
$$;

grant execute on function my_sms_gateway() to authenticated;

-- Defined here, after sms_gateways, because a language-sql body is
-- validated at creation and this function reads that table.
create or replace function my_wallet()
returns table (balance_cents bigint, low_balance_threshold_cents bigint, sms_price_cents integer,
               whatsapp_price_cents integer, included_sms_monthly integer, included_sms_used integer,
               allows_own_gateway boolean, own_gateway_active boolean)
language sql
security definer
stable
as $$
  with me as (select organization_id from profiles where id = auth.uid()),
  plan as (
    select p.* from subscriptions s
    join subscription_plans p on p.id = s.plan_id, me
    where s.organization_id = me.organization_id
    order by s.created_at desc limit 1
  )
  select
    coalesce((select w.balance_cents from message_wallets w, me where w.organization_id = me.organization_id), 0),
    coalesce((select w.low_balance_threshold_cents from message_wallets w, me where w.organization_id = me.organization_id), 20000),
    (select r.price_cents from message_rates r where r.channel = 'sms'),
    (select r.price_cents from message_rates r where r.channel = 'whatsapp'),
    (select plan.included_sms_monthly from plan),
    (select count(*)::integer from wallet_transactions t, me
      where t.organization_id = me.organization_id
        and t.kind = 'included_allowance' and t.channel = 'sms'
        and t.created_at >= date_trunc('month', now())),
    (select plan.allows_own_gateway from plan),
    coalesce((select g.is_active from sms_gateways g, me where g.organization_id = me.organization_id), false);
$$;

grant execute on function my_wallet() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Promise to pay
--
-- From collections practice: a debtor who states a date they will pay by
-- is far more likely to pay than one chased on a generic schedule. So
-- capture the commitment as a first class record with the date they gave,
-- then follow up on THAT date rather than on a fixed cadence.
--
-- The kept/broken history is the valuable part. Once you know a client
-- has broken three promises, you stop extending informal credit to them,
-- and you can show the insurer why.
-- ---------------------------------------------------------------------------

create table payment_promises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  policy_id uuid references policies(id) on delete set null,

  amount_kes integer not null,
  promised_date date not null,
  -- What they actually said, in their words. Useful when a dispute starts.
  commitment_note text,
  channel text check (channel in ('call', 'whatsapp', 'sms', 'email', 'in_person')),

  status text not null default 'open'
    check (status in ('open', 'kept', 'partially_kept', 'broken', 'cancelled')),
  amount_paid_kes integer not null default 0,
  settled_at timestamptz,

  -- Reminder the day before, and follow-up on the day if unpaid.
  reminder_sent_at timestamptz,
  followup_sent_at timestamptz,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_promises_due_idx on payment_promises(promised_date) where status = 'open';
create index payment_promises_client_idx on payment_promises(client_id, created_at desc);

alter table payment_promises enable row level security;

create policy promises_own on payment_promises for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

/** Reliability score for a client: how many promises they have kept.
 *  Shown on the client profile so whoever picks up the phone next knows
 *  who they are dealing with. */
create or replace function client_promise_record(p_client_id uuid)
returns table (total integer, kept integer, broken integer, open_count integer, open_amount_kes integer)
language sql
security definer
stable
as $$
  select
    count(*) filter (where status <> 'cancelled')::integer,
    count(*) filter (where status in ('kept', 'partially_kept'))::integer,
    count(*) filter (where status = 'broken')::integer,
    count(*) filter (where status = 'open')::integer,
    coalesce(sum(amount_kes - amount_paid_kes) filter (where status = 'open'), 0)::integer
  from payment_promises
  where client_id = p_client_id;
$$;

grant execute on function client_promise_record(uuid) to authenticated;

/** Daily: mark passed promises broken and raise a follow-up task. A
 *  promise that quietly expires is worse than none, because the client
 *  learns the date was never real. */
create or replace function process_payment_promises()
returns void
language plpgsql
security definer
as $$
begin
  -- Anything still open the day after its date is broken.
  update payment_promises
     set status = 'broken', updated_at = now()
   where status = 'open' and promised_date < current_date;

  insert into tasks (organization_id, client_id, title, task_type, due_date, priority, status)
  select p.organization_id, p.client_id,
         'Broken payment promise, KES ' || (p.amount_kes - p.amount_paid_kes),
         'call', current_date, 'high', 'open'
    from payment_promises p
   where p.status = 'broken'
     and p.promised_date = current_date - 1
     and not exists (
       select 1 from tasks t
        where t.client_id = p.client_id
          and t.due_date = current_date
          and t.title like 'Broken payment promise%'
     );
end;
$$;

select cron.schedule(
  'process-payment-promises',
  '30 3 * * *',
  $$select process_payment_promises();$$
);

-- ---------------------------------------------------------------------------
-- 5. Dependant age-out warnings
--
-- Children age off medical cover at a scheme's limit, commonly 18, or 25
-- if in full time education. Nobody notices until a claim is declined,
-- and then it is the intermediary who gets blamed. This is the single
-- highest value automation the member schedule makes possible.
-- ---------------------------------------------------------------------------

alter table insurance_types
  add column if not exists dependant_age_limit integer;

create or replace function find_aging_out_dependants(p_days_ahead integer default 60)
returns table (
  member_id uuid, member_name text, date_of_birth date, turns_age integer,
  age_out_date date, policy_id uuid, client_id uuid, principal_name text
)
language sql
security definer
stable
as $$
  select pm.id, pm.full_name, pm.date_of_birth,
         it.dependant_age_limit,
         (pm.date_of_birth + (it.dependant_age_limit || ' years')::interval)::date,
         p.id, p.client_id,
         parent.full_name
    from policy_members pm
    join policies p on p.id = pm.policy_id
    join insurance_types it on it.id = p.insurance_type_id
    left join policy_members parent on parent.id = pm.parent_member_id
   where pm.member_role = 'child'
     and pm.effective_to is null
     and pm.date_of_birth is not null
     and it.dependant_age_limit is not null
     and p.organization_id = (select organization_id from profiles where id = auth.uid())
     and (pm.date_of_birth + (it.dependant_age_limit || ' years')::interval)::date
           between current_date and current_date + p_days_ahead
   order by 5;
$$;

grant execute on function find_aging_out_dependants(integer) to authenticated;
