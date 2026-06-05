-- D.A.N.I.S.H Initial Schema
-- Run: psql $DATABASE_URL -f supabase/migrations/00001_initial_schema.sql

-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Users table (custom metadata alongside auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Memories (with pgvector embedding)
CREATE TABLE IF NOT EXISTS public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  importance INTEGER DEFAULT 5,
  tags TEXT[] DEFAULT '{}',
  shared_with UUID[] DEFAULT '{}',
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  remind_at TIMESTAMPTZ,
  recurring TEXT,
  shared BOOLEAN DEFAULT FALSE,
  shared_with UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Devices
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  health JSONB DEFAULT '{}',
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Device commands (audit log)
CREATE TABLE IF NOT EXISTS public.device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  command TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;

-- Health tracking
CREATE TABLE IF NOT EXISTS public.health_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_hours DECIMAL(4,1),
  food TEXT,
  water_ml INTEGER,
  mood TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.health_tracking ENABLE ROW LEVEL SECURITY;

-- Sleep tracking
CREATE TABLE IF NOT EXISTS public.sleep_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INTEGER,
  quality INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.sleep_tracking ENABLE ROW LEVEL SECURITY;

-- Mood tracking
CREATE TABLE IF NOT EXISTS public.mood_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT NOW(),
  mood TEXT NOT NULL DEFAULT 'neutral',
  intensity INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.mood_tracking ENABLE ROW LEVEL SECURITY;

-- Study tracking
CREATE TABLE IF NOT EXISTS public.study_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'General',
  duration_minutes INTEGER DEFAULT 30,
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.study_tracking ENABLE ROW LEVEL SECURITY;

-- Automations
CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  trigger JSONB DEFAULT '{}',
  steps JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

-- Relationship goals
CREATE TABLE IF NOT EXISTS public.relationship_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  progress INTEGER DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.relationship_goals ENABLE ROW LEVEL SECURITY;

-- Shared space
CREATE TABLE IF NOT EXISTS public.shared_space (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a, user_b)
);
ALTER TABLE public.shared_space ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_category ON public.memories(category);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON public.memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON public.reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_device_id ON public.device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_health_tracking_user_date ON public.health_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sleep_tracking_user_date ON public.sleep_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_mood_tracking_user_id ON public.mood_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_study_tracking_user_id ON public.study_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_goals_owner ON public.relationship_goals(owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_space_users ON public.shared_space(user_a, user_b);

-- RLS policies: users can only access their own data
CREATE POLICY "users_self" ON public.users USING (id = auth.uid());
CREATE POLICY "profiles_self" ON public.profiles USING (id = auth.uid());
CREATE POLICY "memories_self" ON public.memories USING (user_id = auth.uid() OR auth.uid() = ANY(shared_with));
CREATE POLICY "reminders_self" ON public.reminders USING (user_id = auth.uid() OR auth.uid() = ANY(shared_with));
CREATE POLICY "devices_self" ON public.devices USING (user_id = auth.uid());
CREATE POLICY "device_commands_self" ON public.device_commands USING (user_id = auth.uid());
CREATE POLICY "health_tracking_self" ON public.health_tracking USING (user_id = auth.uid());
CREATE POLICY "sleep_tracking_self" ON public.sleep_tracking USING (user_id = auth.uid());
CREATE POLICY "mood_tracking_self" ON public.mood_tracking USING (user_id = auth.uid());
CREATE POLICY "study_tracking_self" ON public.study_tracking USING (user_id = auth.uid());
CREATE POLICY "automations_self" ON public.automations USING (user_id = auth.uid());
CREATE POLICY "relationship_goals_self" ON public.relationship_goals USING (owner_id = auth.uid() OR partner_id = auth.uid());
CREATE POLICY "shared_space_self" ON public.shared_space USING (user_a = auth.uid() OR user_b = auth.uid());
