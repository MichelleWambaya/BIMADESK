-- Adds the rating and testimonial system. Run after 0001-0010.
--
-- HOW THE 100 USER GATE WORKS: the rating prompt only appears to users
-- once the platform has at least the configured number of organizations
-- (default 100), and the public testimonial section on the landing page
-- only renders once there are approved testimonials to show. Both are
-- checked server side via the functions below rather than hardcoded in
-- the frontend, so you can change the threshold without a redeploy.
--
-- Nothing a user writes goes public automatically. Every rating starts
-- unapproved and you approve it from the admin panel. That matters: a
-- testimonial wall is a public claim about your product, and auto
-- publishing whatever people type is how you end up quoting something
-- you did not intend to.

create table ratings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  comment text,
  role_label text,
  approved_as_testimonial boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One rating per person. They can edit theirs, not stack up several.
  unique (user_id)
);

alter table ratings enable row level security;

-- A person can see and manage only their own rating.
create policy ratings_own on ratings for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Platform admins can see and moderate everything.
create policy ratings_admin on ratings for all
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- Config, so the threshold is data rather than a hardcoded constant.
-- ---------------------------------------------------------------------------

create table platform_settings (
  key text primary key,
  value_int integer,
  value_text text
);

insert into platform_settings (key, value_int) values ('testimonial_min_orgs', 100)
on conflict (key) do nothing;

-- True once the platform is big enough to start asking for ratings.
create or replace function ratings_collection_open()
returns boolean
language sql
security definer
stable
as $$
  select (select count(*) from organizations)
       >= coalesce((select value_int from platform_settings where key = 'testimonial_min_orgs'), 100);
$$;

-- Whether the signed-in user still needs to be asked. False if
-- collection is not open yet, or if they have already rated.
create or replace function should_prompt_for_rating()
returns boolean
language sql
security definer
stable
as $$
  select ratings_collection_open()
     and not exists (select 1 from ratings where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Public testimonials. Deliberately a function returning only approved
-- rows with only the fields needed for display, rather than a policy on
-- the ratings table itself. That way approving a testimonial exposes a
-- name, role, and comment, and never anything else on the row.
-- ---------------------------------------------------------------------------

create or replace function public_testimonials()
returns table (
  id uuid,
  stars integer,
  comment text,
  author_name text,
  role_label text,
  business_name text,
  avatar_url text,
  avatar_color text,
  approved_at timestamptz
)
language sql
security definer
stable
as $$
  select r.id, r.stars, r.comment,
         p.full_name as author_name,
         r.role_label,
         o.name as business_name,
         p.avatar_url,
         p.avatar_color,
         r.approved_at
  from ratings r
  join profiles p on p.id = r.user_id
  join organizations o on o.id = r.organization_id
  where r.approved_as_testimonial = true
    and r.comment is not null
    and length(trim(r.comment)) > 0
  order by r.approved_at desc nulls last
  limit 12;
$$;

-- Average rating and count, for "4.8 out of 5 from 120 agents" style
-- social proof. Counts every rating, not only approved ones, since the
-- average should reflect everyone who answered.
create or replace function rating_summary()
returns table (average numeric, total integer)
language sql
security definer
stable
as $$
  select round(avg(stars)::numeric, 1) as average, count(*)::integer as total from ratings;
$$;

-- Anonymous visitors need these on the public landing page.
grant execute on function public_testimonials() to anon, authenticated;
grant execute on function ratings_collection_open() to anon, authenticated;
grant execute on function rating_summary() to anon, authenticated;
grant execute on function should_prompt_for_rating() to authenticated;
