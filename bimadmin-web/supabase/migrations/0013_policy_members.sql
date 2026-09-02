-- Policy membership: who is actually covered under a policy.
-- Run after 0001-0012.
--
-- THE TWO SHAPES THIS HAS TO SUPPORT
--
-- Retail (clients.client_type = 'individual'):
--   Client: Michael John
--     Policy MED-001
--       Michael John        principal   <- same person as the client
--         Grace John        spouse
--         Brian John        child
--
-- Corporate (clients.client_type = 'company'):
--   Client: Safaricom Sacco
--     Policy MED-042
--       Employee A          principal   <- NOT a client record
--         spouse, children  dependants
--       Employee B          principal
--         spouse, children  dependants
--       ... x 400
--
-- DELIBERATE CHOICE: members live on the policy, not on the client, and
-- corporate employees are NOT client rows.
--
-- Making each employee a client would look tempting because they behave
-- like members, but it breaks three things at once: a 400 employee scheme
-- would consume 400 of the organization's client allowance, the client
-- list would fill with people the intermediary has no direct
-- relationship with, and renewal reminders would target employees rather
-- than the Sacco that actually holds and pays for the policy. The client
-- is who you sell to and invoice. The member is who is covered. Those are
-- different things and conflating them is a mistake that is very
-- expensive to undo later.
--
-- For retail, the principal member and the client are the same human, so
-- `client_id` links them and the principal row is created automatically.

create table policy_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,

  -- Null for a principal member, set for a dependant. Depth is capped at
  -- two by the trigger below: a dependant cannot carry dependants of
  -- their own, which is how medical schemes actually work.
  parent_member_id uuid references policy_members(id) on delete cascade,

  -- Set only when this member is also a client in their own right, which
  -- in practice means the principal on a retail policy.
  client_id uuid references clients(id) on delete set null,

  relationship text not null default 'principal'
    check (relationship in ('principal', 'spouse', 'child', 'parent', 'sibling', 'other')),

  full_name text not null,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  national_id text,
  phone text,
  email text,

  -- The insurer's own identifiers. Two separate fields because they are
  -- genuinely different numbers and reconciliation needs both: the
  -- insurer issues a member number, the employer knows the staff number.
  member_number text,
  employee_number text,

  -- Effective dating rather than deletion. A member who left mid term was
  -- still covered for part of it, which matters for claims history and
  -- for pro rata premium, so removals set `effective_to` and nothing is
  -- ever destroyed.
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended', 'removed')),
  effective_from date not null default current_date,
  effective_to date,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index policy_members_policy_idx on policy_members(policy_id) where status = 'active';
create index policy_members_parent_idx on policy_members(parent_member_id);
create index policy_members_org_idx on policy_members(organization_id);
create index policy_members_client_idx on policy_members(client_id);

alter table policy_members enable row level security;

create policy policy_members_org on policy_members for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Structural rules, enforced in the database.
-- ---------------------------------------------------------------------------

create or replace function validate_policy_member()
returns trigger
language plpgsql
as $$
declare
  parent record;
  client_kind text;
  principal_count integer;
begin
  -- A dependant must hang off a principal, never off another dependant.
  if new.parent_member_id is not null then
    select * into parent from policy_members where id = new.parent_member_id;

    if parent is null then
      raise exception 'MEMBER_PARENT_NOT_FOUND';
    end if;

    if parent.parent_member_id is not null then
      raise exception 'MEMBER_NESTING_TOO_DEEP';
    end if;

    if parent.policy_id <> new.policy_id then
      raise exception 'MEMBER_PARENT_WRONG_POLICY';
    end if;

    -- Someone with a parent is by definition not a principal.
    if new.relationship = 'principal' then
      raise exception 'MEMBER_PRINCIPAL_CANNOT_HAVE_PARENT';
    end if;
  else
    -- No parent means principal, and only principals may have no parent.
    if new.relationship <> 'principal' then
      raise exception 'MEMBER_DEPENDANT_NEEDS_PRINCIPAL';
    end if;
  end if;

  -- A retail policy covers one household, so it gets one principal. A
  -- corporate policy is a group scheme and gets many. The client type
  -- decides which, so the rule cannot be got wrong from the interface.
  if new.parent_member_id is null then
    select c.client_type into client_kind
      from policies p join clients c on c.id = p.client_id
     where p.id = new.policy_id;

    if client_kind = 'individual' then
      select count(*) into principal_count
        from policy_members
       where policy_id = new.policy_id
         and parent_member_id is null
         and status <> 'removed'
         and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

      if principal_count >= 1 then
        raise exception 'MEMBER_RETAIL_SINGLE_PRINCIPAL';
      end if;
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists policy_members_validate on policy_members;
create trigger policy_members_validate
  before insert or update on policy_members
  for each row execute function validate_policy_member();

-- ---------------------------------------------------------------------------
-- Movement history.
--
-- Separate from the member row because the questions are different: the
-- member row answers "who is covered now", the movement log answers "what
-- changed, when, and who did it". Insurers bill on movements, and
-- disputes are always about the second question.
-- ---------------------------------------------------------------------------

create table member_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  policy_id uuid not null references policies(id) on delete cascade,
  member_id uuid references policy_members(id) on delete set null,

  -- Kept as text alongside member_id, so the log still reads correctly
  -- after a member row is deleted with a policy.
  member_name text not null,
  movement_type text not null check (movement_type in ('addition', 'removal', 'suspension', 'reinstatement', 'amendment')),
  relationship text,
  effective_date date not null,
  reason text,

  -- Pro rata premium effect, positive for additions and negative for
  -- removals. Nullable because it is often not known until the insurer
  -- confirms, and a wrong number here is worse than no number.
  premium_delta_kes integer,

  submitted_to_insurer boolean not null default false,
  submitted_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index member_movements_policy_idx on member_movements(policy_id, effective_date desc);

alter table member_movements enable row level security;

create policy member_movements_org on member_movements for all
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

/** Adds a member and logs the movement in one call, so the two can never
 *  drift apart. Returns the new member id. */
create or replace function add_policy_member(
  p_policy_id uuid,
  p_full_name text,
  p_relationship text,
  p_parent_member_id uuid default null,
  p_date_of_birth date default null,
  p_national_id text default null,
  p_phone text default null,
  p_effective_from date default current_date,
  p_employee_number text default null,
  p_member_number text default null,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  org_id uuid;
  new_id uuid;
begin
  select organization_id into org_id from profiles where id = auth.uid();
  if org_id is null then raise exception 'NO_ORGANIZATION'; end if;

  if not exists (select 1 from policies where id = p_policy_id and organization_id = org_id) then
    raise exception 'POLICY_NOT_FOUND';
  end if;

  insert into policy_members (
    organization_id, policy_id, parent_member_id, relationship, full_name,
    date_of_birth, national_id, phone, effective_from, employee_number,
    member_number, status
  ) values (
    org_id, p_policy_id, p_parent_member_id, p_relationship, p_full_name,
    p_date_of_birth, p_national_id, p_phone, p_effective_from, p_employee_number,
    p_member_number, 'active'
  ) returning id into new_id;

  insert into member_movements (
    organization_id, policy_id, member_id, member_name, movement_type,
    relationship, effective_date, reason, created_by
  ) values (
    org_id, p_policy_id, new_id, p_full_name, 'addition',
    p_relationship, p_effective_from, p_reason, auth.uid()
  );

  return new_id;
end;
$$;

grant execute on function add_policy_member(uuid, text, text, uuid, date, text, text, date, text, text, text) to authenticated;

/** Removes a member by effective dating them out, and cascades to their
 *  dependants: a dependant's cover exists only through their principal,
 *  so leaving them active would misstate who is covered. */
create or replace function remove_policy_member(
  p_member_id uuid,
  p_effective_date date default current_date,
  p_reason text default null
)
returns void
language plpgsql
security definer
as $$
declare
  org_id uuid;
  m record;
  dep record;
begin
  select organization_id into org_id from profiles where id = auth.uid();
  select * into m from policy_members where id = p_member_id and organization_id = org_id;
  if m is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  update policy_members
     set status = 'removed', effective_to = p_effective_date, updated_at = now()
   where id = p_member_id;

  insert into member_movements (
    organization_id, policy_id, member_id, member_name, movement_type,
    relationship, effective_date, reason, created_by
  ) values (
    org_id, m.policy_id, m.id, m.full_name, 'removal',
    m.relationship, p_effective_date, p_reason, auth.uid()
  );

  if m.parent_member_id is null then
    for dep in
      select * from policy_members
       where parent_member_id = p_member_id and status <> 'removed'
    loop
      update policy_members
         set status = 'removed', effective_to = p_effective_date, updated_at = now()
       where id = dep.id;

      insert into member_movements (
        organization_id, policy_id, member_id, member_name, movement_type,
        relationship, effective_date, reason, created_by
      ) values (
        org_id, m.policy_id, dep.id, dep.full_name, 'removal',
        dep.relationship, p_effective_date,
        coalesce(p_reason, '') || ' (principal removed)', auth.uid()
      );
    end loop;
  end if;
end;
$$;

grant execute on function remove_policy_member(uuid, date, text) to authenticated;

/** Member counts for a policy, for showing "1 principal, 3 dependants"
 *  without pulling every row. */
create or replace function policy_member_counts(p_policy_id uuid)
returns table (principals integer, dependants integer, total integer)
language sql
security definer
stable
as $$
  select
    count(*) filter (where pm.parent_member_id is null)::integer,
    count(*) filter (where pm.parent_member_id is not null)::integer,
    count(*)::integer
  from policy_members pm
  where pm.policy_id = p_policy_id and pm.status = 'active';
$$;

grant execute on function policy_member_counts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: give every existing retail policy a principal member matching
-- its client, so the feature does not start out looking empty for people
-- who already have policies.
-- ---------------------------------------------------------------------------

insert into policy_members (
  organization_id, policy_id, client_id, relationship, full_name,
  national_id, phone, effective_from, status
)
select
  p.organization_id,
  p.id,
  c.id,
  'principal',
  trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')),
  c.national_id,
  c.phone,
  p.start_date,
  'active'
from policies p
join clients c on c.id = p.client_id
where c.client_type = 'individual'
  and trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')) <> ''
  and not exists (select 1 from policy_members pm where pm.policy_id = p.id);
