-- BimAdmin core schema
-- Run this against a fresh Supabase project (SQL editor, or via the CLI:
-- supabase db push). Written for Postgres 15+ as shipped by Supabase.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations and people
-- ---------------------------------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  billing_email text,
  mpesa_phone text,
  theme_color text default 'violet',
  renewal_reminder_offsets integer[] not null default '{90,60,30,14,7,3,1}',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'owner' check (role in ('owner', 'admin_user', 'member')),
  is_platform_admin boolean not null default false,
  onboarding_completed boolean not null default false,
  avatar_color text default 'violet',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Subscription plans and billing
-- ---------------------------------------------------------------------------

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  price_kes_monthly integer not null,
  max_clients integer,
  max_team_members integer not null default 1,
  automation_enabled boolean not null default false,
  bulk_import_enabled boolean not null default true,
  sort_order integer not null default 0
);

insert into subscription_plans (key, name, price_kes_monthly, max_clients, max_team_members, automation_enabled, sort_order) values
  ('free', 'Free', 0, 25, 1, false, 1),
  ('starter', 'Starter', 1500, 150, 2, true, 2),
  ('growth', 'Growth', 4000, 750, 5, true, 3),
  ('business', 'Business', 9000, null, 20, true, 4);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid references subscription_plans(id),
  provider text not null check (provider in ('mpesa', 'paystack')),
  amount_kes integer not null,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  mpesa_checkout_request_id text,
  mpesa_merchant_request_id text,
  mpesa_receipt_number text,
  paystack_reference text,
  raw_callback jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Insurance configuration
-- ---------------------------------------------------------------------------

create table insurance_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  key text not null,
  label text not null,
  color text not null default 'violet',
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

create table custom_field_defs (
  id uuid primary key default gen_random_uuid(),
  insurance_type_id uuid not null references insurance_types(id) on delete cascade,
  label text not null,
  field_type text not null check (field_type in ('text', 'number', 'date', 'select', 'boolean')),
  options text[],
  required boolean not null default false,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Domain tables (all scoped to organization_id)
-- ---------------------------------------------------------------------------

create table clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_type text not null default 'individual' check (client_type in ('individual', 'company')),
  first_name text,
  last_name text,
  company_name text,
  phone text not null,
  alt_phone text,
  email text,
  city text,
  country text default 'Kenya',
  preferred_contact_method text default 'call',
  national_id text,
  notes text,
  tags text[] default '{}',
  custom_field_values jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  client_id uuid references clients(id) on delete set null,
  source text,
  stage text not null default 'new',
  insurance_type_id uuid references insurance_types(id),
  estimated_premium_kes integer,
  next_follow_up_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  insurance_type_id uuid references insurance_types(id),
  policy_number text not null,
  insurer text not null,
  start_date date not null,
  end_date date not null,
  premium_kes integer not null,
  payment_frequency text not null default 'annual',
  status text not null default 'active',
  commission_pct numeric(5,2),
  notes text,
  custom_field_values jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  insurance_type_id uuid references insurance_types(id),
  insurer text not null,
  quote_number text not null,
  date_requested date not null default current_date,
  date_received date,
  premium_kes integer,
  expiry_date date,
  coverage_details text,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  client_id uuid references clients(id) on delete set null,
  policy_id uuid references policies(id) on delete set null,
  quotation_id uuid references quotations(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  task_type text not null default 'general',
  due_date date not null,
  due_time time,
  priority text not null default 'normal',
  status text not null default 'open',
  notes text,
  assigned_user_id uuid references profiles(id),
  created_by_automation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table communications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  channel text not null check (channel in ('call', 'sms', 'whatsapp', 'email', 'note')),
  direction text not null default 'outbound',
  policy_id uuid references policies(id) on delete set null,
  quotation_id uuid references quotations(id) on delete set null,
  subject text,
  body text,
  call_outcome text,
  template_id uuid,
  simulated boolean not null default false,
  logged_by_user_id uuid references profiles(id),
  occurred_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_type text not null check (owner_type in ('client', 'policy', 'quotation', 'lead')),
  owner_id uuid not null,
  body text not null,
  author_user_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  owner_type text not null check (owner_type in ('client', 'policy', 'quotation', 'lead')),
  owner_id uuid not null,
  file_name text not null,
  storage_path text,
  category text,
  size_bytes bigint,
  uploaded_by_user_id uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  client_id uuid references clients(id) on delete cascade,
  type text not null,
  summary text not null,
  related_id uuid,
  occurred_at timestamptz not null default now()
);

create table communication_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  name text not null,
  subject text,
  body text not null
);

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_params jsonb default '{}',
  action_title text,
  action_task_type text,
  action_offset_days integer default 0,
  enabled boolean not null default true
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null,
  message text not null,
  related_client_id uuid references clients(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper: current user's organization, used throughout RLS policies
-- ---------------------------------------------------------------------------

create or replace function current_organization_id()
returns uuid
language sql
security definer
stable
as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function is_platform_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Row level security: every table is scoped to the caller's organization,
-- with a platform-admin bypass for the BimAdmin admin panel.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'clients', 'leads', 'policies', 'quotations', 'tasks', 'communications',
    'notes', 'documents', 'activities', 'communication_templates',
    'automation_rules', 'notifications', 'insurance_types'
  ])
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (organization_id = current_organization_id() or is_platform_admin()) with check (organization_id = current_organization_id())',
      t || '_org_scope', t
    );
  end loop;
end $$;

alter table organizations enable row level security;
create policy organizations_self on organizations for select
  using (id = current_organization_id() or is_platform_admin());
create policy organizations_update_self on organizations for update
  using (id = current_organization_id());

alter table profiles enable row level security;
create policy profiles_self on profiles for select
  using (id = auth.uid() or organization_id = current_organization_id() or is_platform_admin());
create policy profiles_update_self on profiles for update
  using (id = auth.uid());

alter table subscriptions enable row level security;
create policy subscriptions_org on subscriptions for select
  using (organization_id = current_organization_id() or is_platform_admin());

alter table payments enable row level security;
create policy payments_org on payments for select
  using (organization_id = current_organization_id() or is_platform_admin());

alter table subscription_plans enable row level security;
create policy plans_public on subscription_plans for select using (true);

alter table custom_field_defs enable row level security;
create policy custom_fields_org on custom_field_defs for all using (
  insurance_type_id in (
    select id from insurance_types
    where organization_id = current_organization_id() or organization_id is null or is_platform_admin()
  )
);

-- ---------------------------------------------------------------------------
-- New user signup: create an organization, a free subscription, and seed
-- the built-in insurance types for that organization. Triggered from the
-- client after auth.signUp() succeeds (see src/lib/onboardingSetup.ts) --
-- kept as an explicit RPC rather than an auth trigger so the client can
-- pass the business name chosen at signup.
-- ---------------------------------------------------------------------------

create or replace function create_organization_for_new_user(business_name text, owner_full_name text, owner_phone text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_org_id uuid;
  free_plan_id uuid;
begin
  insert into organizations (name) values (business_name) returning id into new_org_id;

  insert into profiles (id, organization_id, full_name, phone, role)
  values (auth.uid(), new_org_id, owner_full_name, owner_phone, 'owner');

  select id into free_plan_id from subscription_plans where key = 'free';
  insert into subscriptions (organization_id, plan_id, status) values (new_org_id, free_plan_id, 'active');

  insert into insurance_types (organization_id, key, label, color, is_custom) values
    (new_org_id, 'medical', 'Medical / Health', 'violet', false),
    (new_org_id, 'motor', 'Motor', 'amber', false),
    (new_org_id, 'life', 'Life', 'emerald', false),
    (new_org_id, 'travel', 'Travel', 'violet', false),
    (new_org_id, 'property', 'Home / Property', 'amber', false),
    (new_org_id, 'personal_accident', 'Personal Accident', 'coral', false),
    (new_org_id, 'business', 'Business', 'emerald', false);

  insert into automation_rules (organization_id, name, trigger_type, trigger_params, action_title, action_task_type, action_offset_days, enabled) values
    (new_org_id, 'Renewal follow-up 30 days before expiry', 'policy_expiring_in_days', '{"days": 30}', 'Contact client regarding renewal', 'renewal', 0, true),
    (new_org_id, 'Follow up 3 days after quotation is sent', 'quotation_sent', '{}', 'Follow up on quotation', 'quote_follow_up', 3, true),
    (new_org_id, 'Call new leads the next day', 'lead_created', '{}', 'Call new lead', 'call', 1, true),
    (new_org_id, 'Remind about missing documents every 3 days', 'policy_pending_documents', '{"everyDays": 3}', 'Chase outstanding documents', 'document_request', 3, false);

  return new_org_id;
end;
$$;
