-- Adds team invitations on top of 0001_init.sql. Run this after it.

create table team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null unique,
  role text not null default 'member' check (role in ('admin_user', 'member')),
  created_by uuid references profiles(id),
  accepted_by uuid references profiles(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

alter table team_invites enable row level security;

-- Members of the organization can see and manage their own invites.
create policy team_invites_org on team_invites for all
  using (organization_id = current_organization_id() or is_platform_admin())
  with check (organization_id = current_organization_id());

-- Anyone, including someone who has not signed up yet, can look up a
-- still-valid invite by its code, so the invite landing page can show
-- "You've been invited to join X" before the person has an account.
create policy team_invites_public_lookup on team_invites for select
  using (accepted_at is null and expires_at > now());

create or replace function accept_team_invite(invite_code text)
returns uuid
language plpgsql
security definer
as $$
declare
  invite record;
begin
  select * into invite from team_invites
    where code = invite_code and accepted_at is null and expires_at > now();

  if invite is null then
    raise exception 'This invite is invalid or has expired.';
  end if;

  update team_invites set accepted_at = now(), accepted_by = auth.uid() where id = invite.id;

  insert into profiles (id, organization_id, full_name, role)
  values (auth.uid(), invite.organization_id, '', invite.role)
  on conflict (id) do update set organization_id = invite.organization_id, role = invite.role;

  return invite.organization_id;
end;
$$;
