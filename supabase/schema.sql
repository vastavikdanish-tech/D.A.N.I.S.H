-- Production-ready schema for D.A.N.I.S.H
-- Run this in the Supabase SQL Editor. This file creates the core tables
-- and Row Level Security (RLS) policies required for privacy and sharing.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- Users (mirror table to auth.users, lightweight profile storage)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Detailed user profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- General purpose memories. Supports personal and shared memories.
create table if not exists public.memories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('personal','study','relationship','goal','conversation','note','career','preference','project')),
  title text not null,
  body text not null,
  shared_with uuid[] not null default '{}',
  tags text[] not null default '{}',
  importance integer not null default 5 check (importance >= 1 and importance <= 10),
  embedding vector(3072),
  created_at timestamptz not null default now()
);

-- Relationship-specific memories (optional specialized table)
create table if not exists public.relationship_memories (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Relationship goals shared between two users
create table if not exists public.relationship_goals (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  due_date date,
  created_at timestamptz not null default now()
);

-- Shared spaces between two users
create table if not exists public.shared_space (
  id uuid primary key default uuid_generate_v4(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  name text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Reminders (can be shared)
create table if not exists public.reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  remind_at timestamptz,
  recurring text,
  shared boolean not null default false,
  shared_with uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Health tracking (aggregated)
create table if not exists public.health_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  sleep_hours numeric,
  food jsonb,
  water_ml integer,
  mood text,
  notes text,
  created_at timestamptz not null default now()
);

-- More granular tracking tables
create table if not exists public.sleep_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  duration_minutes integer,
  quality integer check (quality >= 0 and quality <= 10),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.mood_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date timestamptz not null,
  mood text not null,
  intensity integer check (intensity >= 0 and intensity <= 10),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.study_tracking (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text,
  duration_minutes integer not null default 0,
  notes text,
  resources jsonb default '[]',
  date date not null,
  created_at timestamptz not null default now()
);

-- Devices and device commands
create table if not exists public.devices (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  device_type text not null check (device_type in ('laptop','desktop','phone','tablet','tv','server')),
  status text not null default 'offline',
  health jsonb not null default '{}',
  last_seen_at timestamptz
);

create table if not exists public.device_commands (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  command text not null,
  payload jsonb not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  result jsonb,
  created_at timestamptz not null default now(),
  executed_at timestamptz
);

create table if not exists public.automations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  trigger jsonb not null,
  steps jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  goal_type text not null check (goal_type in ('learning','career','income','content','fitness')),
  progress numeric not null default 0 check (progress >= 0 and progress <= 100),
  streak_days integer not null default 0,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.content_projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in ('idea','prompt','youtube','video','audio')),
  source_url text,
  source_text text,
  status text not null default 'draft',
  outputs jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.study_assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  subject text,
  asset_type text not null check (asset_type in ('notes','flashcards','quiz','mock_test','research_report','roadmap')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

-- Enable RLS where appropriate
alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.memories enable row level security;
alter table public.relationship_memories enable row level security;
alter table public.relationship_goals enable row level security;
alter table public.shared_space enable row level security;
alter table public.reminders enable row level security;
alter table public.health_tracking enable row level security;
alter table public.sleep_tracking enable row level security;
alter table public.mood_tracking enable row level security;
alter table public.study_tracking enable row level security;
alter table public.devices enable row level security;
alter table public.device_commands enable row level security;
alter table public.automations enable row level security;
alter table public.goals enable row level security;
alter table public.content_projects enable row level security;
alter table public.study_assets enable row level security;

-- Policies
-- Users/profiles: owner-only
create policy "Users are their own" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "Profiles are owned by user" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Memories: owner or in shared_with array
create policy "memories_select_owner_or_shared" on public.memories
  for select using (
    auth.uid() = user_id OR (shared_with IS NOT NULL AND auth.uid() = ANY(shared_with))
  );

create policy "memories_insert_owner" on public.memories
  for insert with check (auth.uid() = user_id);

create policy "memories_update_owner" on public.memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "memories_delete_owner" on public.memories
  for delete using (auth.uid() = user_id);

-- Relationship memories: owner or partner can access
create policy "relationship_memories_select_owner_or_partner" on public.relationship_memories
  for select using (auth.uid() = owner_id OR auth.uid() = partner_id);
create policy "relationship_memories_insert_owner" on public.relationship_memories
  for insert with check (auth.uid() = owner_id);
create policy "relationship_memories_update_owner_or_partner" on public.relationship_memories
  for update using (auth.uid() = owner_id OR auth.uid() = partner_id) with check (auth.uid() = owner_id OR auth.uid() = partner_id);
create policy "relationship_memories_delete_owner" on public.relationship_memories
  for delete using (auth.uid() = owner_id OR auth.uid() = partner_id);

-- Relationship goals: owner or partner
create policy "relationship_goals_select" on public.relationship_goals
  for select using (auth.uid() = owner_id OR auth.uid() = partner_id);
create policy "relationship_goals_insert" on public.relationship_goals
  for insert with check (auth.uid() = owner_id OR auth.uid() = partner_id);
create policy "relationship_goals_update" on public.relationship_goals
  for update using (auth.uid() = owner_id OR auth.uid() = partner_id) with check (auth.uid() = owner_id OR auth.uid() = partner_id);
create policy "relationship_goals_delete" on public.relationship_goals
  for delete using (auth.uid() = owner_id OR auth.uid() = partner_id);

-- Shared space: members (user_a/user_b)
create policy "shared_space_select" on public.shared_space
  for select using (auth.uid() = user_a OR auth.uid() = user_b);
create policy "shared_space_insert" on public.shared_space
  for insert with check (auth.uid() = user_a OR auth.uid() = user_b);
create policy "shared_space_update" on public.shared_space
  for update using (auth.uid() = user_a OR auth.uid() = user_b) with check (auth.uid() = user_a OR auth.uid() = user_b);
create policy "shared_space_delete" on public.shared_space
  for delete using (auth.uid() = user_a OR auth.uid() = user_b);

-- Reminders: owner or in shared_with
create policy "reminders_select_owner_or_shared" on public.reminders
  for select using (auth.uid() = user_id OR (shared_with IS NOT NULL AND auth.uid() = ANY(shared_with)));
create policy "reminders_insert_owner" on public.reminders
  for insert with check (auth.uid() = user_id);
create policy "reminders_update_owner_or_shared" on public.reminders
  for update using (auth.uid() = user_id OR (shared_with IS NOT NULL AND auth.uid() = ANY(shared_with))) with check (auth.uid() = user_id OR (shared_with IS NOT NULL AND auth.uid() = ANY(shared_with)));
create policy "reminders_delete_owner" on public.reminders
  for delete using (auth.uid() = user_id OR (shared_with IS NOT NULL AND auth.uid() = ANY(shared_with)));

-- Health & tracking: owner-only
create policy "health_tracking_select_owner" on public.health_tracking
  for select using (auth.uid() = user_id);
create policy "health_tracking_insert_owner" on public.health_tracking
  for insert with check (auth.uid() = user_id);
create policy "health_tracking_update_owner" on public.health_tracking
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "health_tracking_delete_owner" on public.health_tracking
  for delete using (auth.uid() = user_id);

create policy "sleep_tracking_select_owner" on public.sleep_tracking
  for select using (auth.uid() = user_id);
create policy "sleep_tracking_insert_owner" on public.sleep_tracking
  for insert with check (auth.uid() = user_id);
create policy "mood_tracking_select_owner" on public.mood_tracking
  for select using (auth.uid() = user_id);
create policy "study_tracking_select_owner" on public.study_tracking
  for select using (auth.uid() = user_id);

create policy "study_tracking_insert_owner" on public.study_tracking
  for insert with check (auth.uid() = user_id);

-- Devices / commands / automations / goals / content / study assets: owner-only
create policy "devices_owner" on public.devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "device_commands_owner" on public.device_commands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "automations_owner" on public.automations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_owner" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "content_projects_owner" on public.content_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "study_assets_owner" on public.study_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Semantic memory search used by the assistant route. Gemini embedding models
-- currently return 3072 dimensions, so this must match memories.embedding.
create or replace function public.match_memories(
  query_embedding vector(3072),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  category text,
  title text,
  body text,
  importance integer,
  similarity float
)
language sql stable
as $$
  select
    memories.id,
    memories.category,
    memories.title,
    memories.body,
    memories.importance,
    1 - (memories.embedding <=> query_embedding) as similarity
  from public.memories
  where memories.embedding is not null
    and (memories.user_id = p_user_id or p_user_id = any(memories.shared_with))
    and 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by memories.embedding <=> query_embedding
  limit match_count;
$$;
