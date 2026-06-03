import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function migrate() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const sql = `
    DROP INDEX IF EXISTS memories_embedding_idx;
    ALTER TABLE public.memories ALTER COLUMN embedding TYPE vector(3072);
    CREATE INDEX memories_embedding_idx ON memories USING hnsw (embedding vector_cosine_ops);
    CREATE OR REPLACE FUNCTION match_memories (
      query_embedding vector(3072),
      match_threshold float,
      match_count int,
      p_user_id uuid
    ) RETURNS TABLE (
      id uuid,
      category text,
      title text,
      body text,
      importance int,
      similarity float
    ) LANGUAGE plpgsql AS $$
    BEGIN
      RETURN QUERY
      SELECT
        memories.id,
        memories.category,
        memories.title,
        memories.body,
        memories.importance,
        1 - (memories.embedding <=> query_embedding) AS similarity
      FROM memories
      WHERE memories.user_id = p_user_id
        AND memories.embedding IS NOT NULL
        AND 1 - (memories.embedding <=> query_embedding) > match_threshold
      ORDER BY memories.importance DESC, similarity DESC
      LIMIT match_count;
    END;
    $$;
  `;

  console.log('Executing SQL Migration to 768 dimensions...');
  const { error } = await supabase.rpc('execute_sql', { sql });
  
  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  console.log('Migration successful: Database set to 768 dimensions.');
}

migrate();
