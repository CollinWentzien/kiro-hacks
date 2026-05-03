-- ============================================================
-- Vision Insights Setup
-- Run this in the Supabase SQL editor before using the feature.
-- ============================================================

-- 1. Create the ecosystem_photos table
create table if not exists ecosystem_photos (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null default 'anonymous',
  image_url        text not null,
  category         text,
  common_name      text,
  scientific_name  text,
  confidence       integer,          -- 0–100
  health_status    text,
  insights         jsonb default '[]'::jsonb,
  recommendations  jsonb default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

-- 2. Index for fast user lookups
create index if not exists ecosystem_photos_user_id_idx
  on ecosystem_photos (user_id, created_at desc);

-- 3. Create the storage bucket (run once)
-- Note: bucket creation via SQL requires the storage schema.
-- If this fails, create the bucket manually in the Supabase dashboard
-- under Storage → New bucket → name: "ecosystem-photos", Public: true
insert into storage.buckets (id, name, public)
values ('ecosystem-photos', 'ecosystem-photos', true)
on conflict (id) do nothing;

-- 4. Storage policy — allow public reads
create policy "Public read ecosystem-photos"
  on storage.objects for select
  using ( bucket_id = 'ecosystem-photos' );

-- 5. Storage policy — allow authenticated and anonymous uploads
create policy "Allow uploads to ecosystem-photos"
  on storage.objects for insert
  with check ( bucket_id = 'ecosystem-photos' );
