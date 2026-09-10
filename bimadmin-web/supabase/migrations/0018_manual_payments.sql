-- Manual payment: pay to till, submit the code, admin approves. After 0017.
--
-- Automated verification needs Daraja Go Live, which needs a shortcode
-- registered to a business. Until that exists there is no programmatic way
-- to confirm a payment landed, so the flow is: the customer pays to the
-- till, submits the M-Pesa confirmation code, and an admin matches it
-- against the merchant statement and approves.
--
-- The whole design problem here is that the code is typed by the person
-- who benefits from it being accepted. So the safeguards below matter more
-- than the happy path.

-- ---------------------------------------------------------------------------
-- Where the till number and QR live. Held in platform_settings so they can
-- be changed without a deploy.
-- ---------------------------------------------------------------------------

insert into platform_settings (key, value_text) values
  ('payment_till_number', null),
  ('payment_till_name', null),
  ('payment_qr_image_url', null),
  ('payment_instructions_note', null)
on conflict (key) do nothing;

create or replace function payment_instructions()
returns table (till_number text, till_name text, qr_image_url text, note text)
language sql stable as $$
  select
    (select value_text from platform_settings where key = 'payment_till_number'),
    (select value_text from platform_settings where key = 'payment_till_name'),
    (select value_text from platform_settings where key = 'payment_qr_image_url'),
    (select value_text from platform_settings where key = 'payment_instructions_note');
$$;

grant execute on function payment_instructions() to authenticated;

-- ---------------------------------------------------------------------------
-- Submissions
-- ---------------------------------------------------------------------------

create table manual_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  submitted_by uuid references profiles(id) on delete set null,

  -- Uppercased and trimmed by the insert function. M-Pesa codes are ten
  -- characters, letters and digits, e.g. SGR7HJ2K9L.
  mpesa_code text not null,

  -- What the customer says they paid, and what we expected. Kept apart on
  -- purpose: if they differ, that is the single most useful thing on the
  -- admin screen, and overwriting the claim with the expected figure would
  -- hide exactly the case worth looking at.
  amount_claimed_kes integer not null,
  amount_expected_kes integer not null,

  paid_from_phone text,
  paid_at date,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now(),

  -- THE IMPORTANT ONE. A confirmation code identifies exactly one M-Pesa
  -- transaction, so the same code must never be accepted twice. Without
  -- this, one genuine payment could be submitted by several organizations,
  -- or repeatedly by the same one, and each would look valid on its own.
  constraint manual_payments_code_unique unique (mpesa_code)
);

create index manual_payments_pending_idx on manual_payments(created_at desc) where status = 'pending';
create index manual_payments_org_idx on manual_payments(organization_id, created_at desc);

alter table manual_payments enable row level security;

create policy manual_payments_own_select on manual_payments for select
  using (organization_id = (select organization_id from profiles where id = auth.uid())
         or is_platform_admin());

-- Inserts go through submit_manual_payment() only, so the expected amount
-- cannot be supplied by the caller.
create policy manual_payments_admin_update on manual_payments for update
  using (is_platform_admin());

/**
 * Records a payment claim.
 *
 * Returns 'ok', 'duplicate_code', 'bad_code', or 'unknown_plan'.
 *
 * The expected amount is looked up here rather than accepted as an
 * argument, so a caller cannot declare that the Agency plan costs fifty
 * shillings. The claimed amount is recorded as given, because the gap
 * between claimed and expected is the thing an admin needs to see.
 */
create or replace function submit_manual_payment(
  p_plan_id uuid,
  p_mpesa_code text,
  p_amount_claimed_kes integer,
  p_paid_from_phone text default null,
  p_paid_at date default null
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

  clean_code := upper(regexp_replace(coalesce(p_mpesa_code, ''), '[^A-Za-z0-9]', '', 'g'));

  -- Format check before the uniqueness check, so a typo gets a useful
  -- message instead of being reported as a duplicate.
  if length(clean_code) <> 10 then
    return 'bad_code';
  end if;

  select * into plan from subscription_plans where id = p_plan_id and is_active;
  if plan is null then return 'unknown_plan'; end if;

  expected := plan_price_kes(plan.key);

  insert into manual_payments
    (organization_id, plan_id, submitted_by, mpesa_code,
     amount_claimed_kes, amount_expected_kes, paid_from_phone, paid_at)
  values
    (org_id, p_plan_id, auth.uid(), clean_code,
     p_amount_claimed_kes, expected, p_paid_from_phone, p_paid_at);

  return 'ok';
exception
  when unique_violation then
    -- Deliberately does not say whether the existing claim was this
    -- organization's or someone else's. That would let anyone probe
    -- whether a given code has been used.
    return 'duplicate_code';
end;
$$;

grant execute on function submit_manual_payment(uuid, text, integer, text, date) to authenticated;

/**
 * Approves a claim and moves the subscription.
 *
 * Extends from the later of today and the current period end, so approving
 * a renewal early does not throw away time the customer has already paid
 * for.
 */
create or replace function approve_manual_payment(p_id uuid, p_note text default null)
returns text
language plpgsql
security definer
as $$
declare
  mp record;
  current_end timestamptz;
  new_end timestamptz;
begin
  if not is_platform_admin() then
    raise exception 'Only platform admins can approve payments';
  end if;

  select * into mp from manual_payments where id = p_id for update;
  if mp is null then return 'not_found'; end if;
  if mp.status <> 'pending' then return 'already_reviewed'; end if;

  select current_period_end into current_end
    from subscriptions where organization_id = mp.organization_id;

  new_end := greatest(coalesce(current_end, now()), now()) + interval '1 month';

  update subscriptions set
    plan_id = mp.plan_id,
    status = 'active',
    current_period_start = now(),
    current_period_end = new_end,
    trial_ends_at = null,
    read_only_since = null,
    updated_at = now()
  where organization_id = mp.organization_id;

  -- A payments row so manual and future automated payments appear in one
  -- history rather than two places that have to be reconciled by eye.
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

create or replace function reject_manual_payment(p_id uuid, p_note text)
returns text
language plpgsql
security definer
as $$
begin
  if not is_platform_admin() then
    raise exception 'Only platform admins can reject payments';
  end if;

  update manual_payments set
    status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = p_note
  where id = p_id and status = 'pending';

  if not found then return 'not_found_or_reviewed'; end if;
  return 'ok';
end;
$$;

grant execute on function reject_manual_payment(uuid, text) to authenticated;

-- Rejected codes are freed for resubmission. A genuine payment mistyped
-- once should not have its real code permanently blocked by the typo.
create or replace function release_rejected_code()
returns trigger language plpgsql as $$
begin
  if new.status = 'rejected' then
    new.mpesa_code := new.mpesa_code || '#R' || substr(new.id::text, 1, 4);
  end if;
  return new;
end;
$$;

create trigger manual_payments_release_code
  before update of status on manual_payments
  for each row when (new.status = 'rejected')
  execute function release_rejected_code();

alter table payments drop constraint if exists payments_provider_check;
alter table payments add constraint payments_provider_check
  check (provider in ('mpesa', 'paystack', 'mpesa_manual'));

/** Pending queue for the admin screen. */
create or replace function pending_manual_payments()
returns table (
  id uuid, organization_name text, plan_name text, mpesa_code text,
  amount_claimed_kes integer, amount_expected_kes integer,
  paid_from_phone text, paid_at date, submitted_by_name text, created_at timestamptz
)
language sql security definer stable as $$
  select mp.id, o.name, p.name, mp.mpesa_code,
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

-- ---------------------------------------------------------------------------
-- Admin write access to organizations and subscriptions.
--
-- This is why "Change plan" on the admin panel never worked. subscriptions
-- has had a SELECT policy only since 0001, and organizations allows UPDATE
-- only on your own row. Row level security rejects a write it does not
-- permit by matching zero rows rather than raising, so the dropdown
-- appeared to succeed and changed nothing.
-- ---------------------------------------------------------------------------

create policy organizations_admin_update on organizations for update
  using (is_platform_admin());

create policy organizations_admin_delete on organizations for delete
  using (is_platform_admin());

create policy subscriptions_admin_insert on subscriptions for insert
  with check (is_platform_admin());

create policy subscriptions_admin_update on subscriptions for update
  using (is_platform_admin());

-- Approving a manual payment runs as security definer, so it did not need
-- these. The admin dropdown runs as the signed-in admin, so it does.

-- ---------------------------------------------------------------------------
-- Clear the dashboard activity feed, without deleting anything.
--
-- Activities are the audit trail of who did what, and deleting them to
-- tidy the dashboard would destroy that record. Instead the organization
-- carries a watermark: anything that happened before it is hidden from the
-- feed but still on every client's timeline and still in exports.
-- Reversible by nulling the column.
-- ---------------------------------------------------------------------------

alter table organizations
  add column if not exists activities_hidden_before timestamptz;

/** Hides everything currently in the feed. Members of the org may call it. */
create or replace function clear_activity_feed()
returns void
language sql security definer as $$
  update organizations
     set activities_hidden_before = now()
   where id = (select organization_id from profiles where id = auth.uid());
$$;

grant execute on function clear_activity_feed() to authenticated;
