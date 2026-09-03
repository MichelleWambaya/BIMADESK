-- Client taxonomy, policy rejections, commission tracking. After 0015.

-- ---------------------------------------------------------------------------
-- 1. Client types
--
-- 'individual' and 'company' were too blunt. The distinctions that
-- actually change how you work are: what KYC you must collect, whether
-- the client has a member schedule, and whether the payer is the same
-- person as the insured.
--
--   individual       one person, their own policies
--   family           one policyholder covering a household
--   sole_proprietor  trades under a business name, but KYC is personal
--   company          limited company, corporate KYC and directors
--   group            sacco, welfare group, chama, association: many
--                    principal members each with their own dependants
--
-- sole_proprietor is separated from company deliberately. Legally it is a
-- person, so it needs an ID rather than a certificate of incorporation,
-- and filing it under 'company' means the KYC checklist asks for
-- documents that do not exist.
-- ---------------------------------------------------------------------------

alter table clients drop constraint if exists clients_client_type_check;
alter table clients add constraint clients_client_type_check
  check (client_type in ('individual', 'family', 'sole_proprietor', 'company', 'group'));

alter table clients
  add column if not exists registration_number text,   -- company or society number
  add column if not exists kra_pin text,
  add column if not exists contact_person_name text,   -- for entities
  add column if not exists contact_person_role text;

-- Existing rows: 'company' stays valid, so nothing to migrate.

/** Whether a client type holds a member schedule. Families and groups do;
 *  an individual is their own single member. */
create or replace function client_type_has_members(p_type text)
returns boolean language sql immutable as $$
  select p_type in ('family', 'company', 'group');
$$;

/** Whether a client type is an entity rather than a natural person.
 *  sole_proprietor is a person, which is the whole reason it is separate. */
create or replace function client_type_is_entity(p_type text)
returns boolean language sql immutable as $$
  select p_type in ('company', 'group');
$$;

-- KYC checklist per client type. Held as data so an intermediary can
-- adjust it to what their insurers actually demand, rather than being
-- hardcoded to one insurer's paperwork.
create table kyc_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  client_type text not null,
  document_name text not null,
  is_mandatory boolean not null default true,
  sort_order integer not null default 0,
  unique (organization_id, client_type, document_name)
);

alter table kyc_requirements enable row level security;

create policy kyc_req_org on kyc_requirements for all
  using (organization_id is null
         or organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- Platform defaults, organization_id null. Copied per org on first edit.
insert into kyc_requirements (organization_id, client_type, document_name, is_mandatory, sort_order) values
  (null, 'individual', 'National ID or passport', true, 1),
  (null, 'individual', 'KRA PIN certificate', true, 2),
  (null, 'individual', 'Passport photo', false, 3),

  (null, 'family', 'Principal member ID', true, 1),
  (null, 'family', 'KRA PIN certificate', true, 2),
  (null, 'family', 'Marriage certificate', false, 3),
  (null, 'family', 'Birth certificates for children', true, 4),

  (null, 'sole_proprietor', 'Owner National ID', true, 1),
  (null, 'sole_proprietor', 'Business name registration', true, 2),
  (null, 'sole_proprietor', 'KRA PIN certificate', true, 3),
  (null, 'sole_proprietor', 'Business permit', false, 4),

  (null, 'company', 'Certificate of incorporation', true, 1),
  (null, 'company', 'CR12', true, 2),
  (null, 'company', 'Company KRA PIN', true, 3),
  (null, 'company', 'Directors identification', true, 4),
  (null, 'company', 'Board resolution', false, 5),

  (null, 'group', 'Certificate of registration', true, 1),
  (null, 'group', 'Constitution or by-laws', true, 2),
  (null, 'group', 'Group KRA PIN', true, 3),
  (null, 'group', 'Officials identification', true, 4),
  (null, 'group', 'Member schedule', true, 5)
on conflict do nothing;

/** The checklist for a client, with whether each document is on file. */
create or replace function client_kyc_status(p_client_id uuid)
returns table (document_name text, is_mandatory boolean, is_uploaded boolean)
language sql security definer stable as $$
  with c as (select client_type, organization_id from clients where id = p_client_id),
  reqs as (
    select r.document_name, r.is_mandatory, r.sort_order
      from kyc_requirements r, c
     where r.client_type = c.client_type
       and (r.organization_id = c.organization_id or r.organization_id is null)
  )
  select distinct on (reqs.document_name)
         reqs.document_name, reqs.is_mandatory,
         exists (
           select 1 from documents d
            where d.owner_type = 'client' and d.owner_id = p_client_id
              and d.category = reqs.document_name
         )
    from reqs
   order by reqs.document_name, reqs.sort_order;
$$;

grant execute on function client_kyc_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Policy rejections
--
-- A policy does not go straight from submitted to active. It can bounce,
-- and the reason determines who has to do what next. Previously a
-- rejected policy had nowhere to live, so it either sat as 'active' when
-- it was not, or was deleted and the history lost.
-- ---------------------------------------------------------------------------

alter table policies drop constraint if exists policies_status_check;
alter table policies add constraint policies_status_check
  check (status in (
    'draft',
    'submitted',          -- with the insurer, awaiting a decision
    'pending_documents',  -- we are waiting on the client
    'pending_payment',    -- awaiting premium before cover starts
    'rejected',
    'active',
    'lapsed',
    'expired',
    'cancelled'
  ));

create table policy_rejections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,

  reason_code text not null check (reason_code in (
    'bounced_cheque',
    'insufficient_funds',
    'incomplete_application',
    'missing_documents',
    'failed_kyc',
    'legal_or_compliance',      -- companies: litigation, sanctions, adverse
    'adverse_medical',
    'risk_declined',            -- insurer will not take the risk
    'vehicle_inspection_failed',
    'valuation_required',
    'duplicate_cover',
    'premium_dispute',
    'other'
  )),
  detail text,
  -- Which side has to act. Drives whose task list it lands on, and is the
  -- difference between "chase the client" and "chase the insurer".
  responsibility text not null default 'client'
    check (responsibility in ('client', 'insurer', 'intermediary')),

  rejected_on date not null default current_date,
  raised_by_insurer text,

  is_resolved boolean not null default false,
  resolved_on date,
  resolution_note text,
  -- Set when a corrected submission supersedes this one, so you can
  -- follow a policy through several bounces without losing the chain.
  superseded_by_policy_id uuid references policies(id) on delete set null,

  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index policy_rejections_policy_idx on policy_rejections(policy_id, rejected_on desc);
create index policy_rejections_open_idx on policy_rejections(organization_id) where is_resolved = false;

alter table policy_rejections enable row level security;

create policy rejections_org on policy_rejections for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

/** Records a rejection, moves the policy, and raises a task for whoever
 *  has to act. One function so the three never drift apart: a rejection
 *  with no task is a rejection nobody chases. */
create or replace function reject_policy(
  p_policy_id uuid,
  p_reason_code text,
  p_detail text default null,
  p_responsibility text default 'client',
  p_raised_by_insurer text default null
)
returns uuid
language plpgsql security definer as $$
declare
  pol record;
  new_status text;
  rejection_id uuid;
  label text;
begin
  select * into pol from policies where id = p_policy_id;
  if pol is null then raise exception 'Policy not found'; end if;
  if pol.organization_id <> (select organization_id from profiles where id = auth.uid()) then
    raise exception 'Not your record';
  end if;

  -- Some reasons are recoverable by supplying something, and parking the
  -- policy in a waiting state is more honest than calling it rejected.
  new_status := case p_reason_code
    when 'missing_documents' then 'pending_documents'
    when 'incomplete_application' then 'pending_documents'
    when 'bounced_cheque' then 'pending_payment'
    when 'insufficient_funds' then 'pending_payment'
    else 'rejected'
  end;

  insert into policy_rejections
    (organization_id, policy_id, reason_code, detail, responsibility,
     raised_by_insurer, created_by)
  values
    (pol.organization_id, p_policy_id, p_reason_code, p_detail, p_responsibility,
     p_raised_by_insurer, auth.uid())
  returning id into rejection_id;

  update policies set status = new_status, updated_at = now() where id = p_policy_id;

  label := replace(p_reason_code, '_', ' ');

  insert into tasks (organization_id, client_id, policy_id, title, task_type, due_date, priority, status)
  values (
    pol.organization_id, pol.client_id, p_policy_id,
    'Resolve policy issue: ' || label,
    case when p_responsibility = 'client' then 'call' else 'admin' end,
    current_date + 2, 'high', 'open'
  );

  insert into activities (organization_id, client_id, type, summary, related_id)
  values (pol.organization_id, pol.client_id, 'policy_rejected',
          'Policy issue recorded: ' || label, p_policy_id);

  return rejection_id;
end;
$$;

grant execute on function reject_policy(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Commission
--
-- What the intermediary actually earns. The rate is entered by them,
-- because it is negotiated per insurer and per class and there is no
-- table anyone could ship that would be right.
--
-- Stored as basis points, not a percent. A rate of 17.5% is 1750 bp and
-- exact; as a float it is 0.17499999999999999 and every total computed
-- from it drifts.
-- ---------------------------------------------------------------------------

alter table insurance_types
  add column if not exists default_commission_bp integer;

alter table policies
  add column if not exists commission_bp integer,
  add column if not exists commission_amount_kes integer,
  add column if not exists commission_status text not null default 'pending'
    check (commission_status in ('pending', 'invoiced', 'received', 'written_off')),
  add column if not exists commission_received_on date,
  add column if not exists commission_note text;

/** Fills commission from the insurance type's default when the policy
 *  does not carry its own rate, and computes the amount. Runs on write so
 *  the stored figure always agrees with the rate and premium beside it. */
create or replace function apply_policy_commission()
returns trigger language plpgsql as $$
declare
  rate_bp integer;
begin
  rate_bp := new.commission_bp;

  if rate_bp is null then
    select it.default_commission_bp into rate_bp
      from insurance_types it where it.id = new.insurance_type_id;
    new.commission_bp := rate_bp;
  end if;

  if rate_bp is not null and new.premium_kes is not null then
    new.commission_amount_kes := round(new.premium_kes::numeric * rate_bp / 10000)::integer;
  end if;

  return new;
end;
$$;

drop trigger if exists policies_apply_commission on policies;
create trigger policies_apply_commission
  before insert or update of premium_kes, commission_bp, insurance_type_id on policies
  for each row execute function apply_policy_commission();

-- Backfill existing rows so reports are not empty on day one.
update policies p set commission_bp = it.default_commission_bp
  from insurance_types it
 where it.id = p.insurance_type_id
   and p.commission_bp is null
   and it.default_commission_bp is not null;

/** Commission earned, by status, for a period. The number an
 *  intermediary actually wants to see. */
create or replace function commission_summary(p_from date, p_to date)
returns table (
  status text, policy_count integer, premium_total_kes bigint, commission_total_kes bigint
)
language sql security definer stable as $$
  select p.commission_status,
         count(*)::integer,
         coalesce(sum(p.premium_kes), 0)::bigint,
         coalesce(sum(p.commission_amount_kes), 0)::bigint
    from policies p
   where p.organization_id = (select organization_id from profiles where id = auth.uid())
     and p.start_date between p_from and p_to
     and p.commission_amount_kes is not null
   group by p.commission_status;
$$;

grant execute on function commission_summary(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Retire the older commission_pct column.
--
-- 0001 shipped a numeric commission_pct that nothing ever wrote to, while
-- the reports page quietly computed earnings from it and therefore always
-- showed zero. Two columns describing the same thing is worse than one
-- wrong one, so any value it does hold is folded into commission_bp and
-- the old column is dropped.
-- ---------------------------------------------------------------------------

update policies
   set commission_bp = round(commission_pct * 100)::integer
 where commission_bp is null
   and commission_pct is not null
   and commission_pct > 0;

-- Recompute amounts for anything just backfilled.
update policies
   set commission_amount_kes = round(premium_kes::numeric * commission_bp / 10000)::integer
 where commission_bp is not null
   and premium_kes is not null
   and commission_amount_kes is null;

alter table policies drop column if exists commission_pct;
