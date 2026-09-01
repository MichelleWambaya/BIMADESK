-- Adds real recurring card billing on top of 0001-0005. Run after them.
--
-- This is the feature M-Pesa structurally cannot have: Paystack lets you
-- reuse a card's authorization code to charge it again later without the
-- customer re-entering their card or approving anything, which is what
-- makes this genuinely silent, unlike the M-Pesa reminder/grace/downgrade
-- lifecycle in 0005 (which still requires the customer to actively pay
-- each time).
--
-- IMPORTANT, same caveat as 0005_subscription_lifecycle.sql: this has
-- never run against a live database or a real Paystack account. Test it
-- deliberately with a small real charge before trusting it unattended --
-- see the notes in charge-saved-card/index.ts for exactly how.

create extension if not exists pg_net;

create table saved_payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null default 'paystack' check (provider = 'paystack'),
  authorization_code text not null,
  card_last4 text,
  card_type text,
  exp_month text,
  exp_year text,
  email text,
  reusable boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, provider)
);

alter table saved_payment_methods enable row level security;

-- Members can see their own saved card (last 4 digits, never the
-- authorization code's underlying card number, which Paystack never
-- gives out anyway -- the authorization_code is only usable server side
-- with your secret key). No client-side insert/update/delete policy is
-- defined on purpose: only the service role (from paystack-webhook and
-- charge-saved-card) is ever allowed to write this table.
create policy saved_payment_methods_read on saved_payment_methods for select
  using (organization_id = current_organization_id() or is_platform_admin());

-- Removing a saved card is safe for the org itself to do directly (it
-- only deletes their own reference to a Paystack authorization code,
-- nothing sensitive is exposed by allowing this); adding or changing one
-- still only ever happens server-side, from paystack-webhook.
create policy saved_payment_methods_delete on saved_payment_methods for delete
  using (organization_id = current_organization_id());

alter table subscriptions add column if not exists auto_renew boolean not null default true;

-- payments never had an error_message column; charge-saved-card needs
-- somewhere to record why an automatic charge failed, for the retry
-- banner logic in BillingPage.tsx to have something useful to show.
alter table payments add column if not exists error_message text;

-- ---------------------------------------------------------------------------
-- Runs a few times a day. For any subscription that's due (or overdue)
-- with auto_renew on and a reusable saved card, asks the
-- charge-saved-card Edge Function to actually charge it. This function
-- only ever *triggers* the charge attempt (pg_net's HTTP calls are
-- asynchronous, so it can't process a response inline); the Edge
-- Function it calls does the real work and is where success/failure is
-- actually decided and recorded.
--
-- Replace CHARGE_FUNCTION_URL and CHARGE_JOB_SECRET below with your real
-- values before running this migration -- they can't be known ahead of
-- time since they depend on your project ref and a secret you generate.
-- ---------------------------------------------------------------------------

create or replace function charge_due_card_renewals()
returns void
language plpgsql
security definer
as $$
declare
  sub record;
  free_plan_id uuid;
  charge_function_url text := 'https://YOUR-PROJECT-REF.functions.supabase.co/charge-saved-card'; -- TODO: replace
  charge_job_secret text := 'YOUR-CHARGE-JOB-SECRET'; -- TODO: replace, must match CHARGE_JOB_SECRET in charge-saved-card
begin
  select id into free_plan_id from subscription_plans where key = 'free';

  for sub in
    select s.organization_id from subscriptions s
    join saved_payment_methods spm on spm.organization_id = s.organization_id and spm.reusable = true
    where s.auto_renew = true
      and s.plan_id <> free_plan_id
      and s.status in ('active', 'past_due')
      and s.current_period_end is not null
      and s.current_period_end <= now()
      -- Don't attempt twice in the same day if the Edge Function already
      -- tried (successfully or not) -- it always writes a payments row.
      and not exists (
        select 1 from payments p
        where p.organization_id = s.organization_id
          and p.provider = 'paystack'
          and p.created_at > now() - interval '20 hours'
      )
  loop
    perform net.http_post(
      url := charge_function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || charge_job_secret),
      body := jsonb_build_object('organizationId', sub.organization_id)
    );
  end loop;
end;
$$;

select cron.schedule('charge-due-card-renewals', '0 */6 * * *', 'select charge_due_card_renewals();');
