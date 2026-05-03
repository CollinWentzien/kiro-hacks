-- User projects table
-- Stores each user's saved ecosystem project (city + custom species list)

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default 'My Ecosystem',
  city         text not null,
  state        text,
  country      text,
  lat          double precision,
  lng          double precision,
  radius_km    integer not null default 50,
  -- Full city ecosystem snapshot (species array from /api/ecosystem)
  base_species jsonb not null default '[]'::jsonb,
  -- Species the user manually added from the catalog
  added_species jsonb not null default '[]'::jsonb,
  -- Species the user removed from the city base
  removed_species_names text[] not null default '{}',
  -- Climate profile snapshot
  climate_profile jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Index for fast user lookups
create index if not exists projects_user_id_idx on public.projects(user_id);

-- Auto-update updated_at on row change
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();

-- Row Level Security: users can only see and modify their own projects
alter table public.projects enable row level security;

create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);
