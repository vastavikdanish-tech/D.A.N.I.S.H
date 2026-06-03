-- Run these commands in your Supabase SQL Editor to fix permission issues.
-- These grants ensure that the standard Supabase roles have access to the public schema.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant access to all existing tables in public schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Specifically for memories if needed
GRANT ALL ON public.memories TO service_role;
GRANT ALL ON public.memories TO authenticated;
GRANT SELECT ON public.memories TO anon;

-- Ensure RLS is still enabled (it should be)
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
