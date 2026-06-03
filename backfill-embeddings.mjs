import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const geminiKey = process.env.GEMINI_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = 10;
const MAX_RETRIES = 3;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateEmbedding(text, retryCount = 0) {
  if (!geminiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] }
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(`Gemini API error: ${res.status} ${JSON.stringify(errorData)}`);
    }

    const json = await res.json();
    console.log(
      "EMBEDDING_DIMENSIONS:",
      json.embedding.values.length
    );
    return json?.embedding?.values || null;
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      const waitTime = Math.pow(2, retryCount) * 1000;
      console.warn(`\n  Retry ${retryCount + 1}/${MAX_RETRIES} for embedding after error: ${e.message}. Waiting ${waitTime}ms...`);
      await sleep(waitTime);
      return generateEmbedding(text, retryCount + 1);
    }
    console.error(`\n  Failed to generate embedding after ${MAX_RETRIES} retries: ${e.message}`);
    return null;
  }
}

async function fixAndBackfill() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Step 1: Updating database schema (vector dimensions)...");
  const { error: alterError } = await supabase.rpc('execute_sql', {
      sql: `
        -- Disable index temporarily
        drop index if exists memories_embedding_idx;
        -- Alter column to 3072 for gemini-embedding-001
        alter table public.memories alter column embedding type vector(3072);
        -- Recreate index
        create index memories_embedding_idx on memories using hnsw (embedding vector_cosine_ops);
        -- Recreate match function with 3072 dimensions
        create or replace function match_memories (
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
          importance int,
          similarity float
        )
        language plpgsql
        as $$
        begin
          return query
          select
            memories.id,
            memories.category,
            memories.title,
            memories.body,
            memories.importance,
            1 - (memories.embedding <=> query_embedding) as similarity
          from memories
          where memories.user_id = p_user_id
            and memories.embedding is not null
            and 1 - (memories.embedding <=> query_embedding) > match_threshold
          order by memories.importance desc, similarity desc
          limit match_count;
        end;
        $$;
      `
  });

  if (alterError) {
      console.warn("RPC execute_sql failed or returned error. This might be normal if schema is already updated.");
      console.warn("Error details:", alterError.message);
  }

  console.log("Step 2: Backfilling embeddings in batches...");
  
  let processedCount = 0;
  let successCount = 0;
  let totalToProcess = 0;

  // Get total count of memories needing embeddings
  const { count, error: countError } = await supabase
    .from("memories")
    .select("*", { count: 'exact', head: true })
    .is("embedding", null);
  
  if (countError) {
    console.error("Error fetching count:", countError);
    // Fallback: we'll just loop until no more records are found
    totalToProcess = "unknown";
  } else {
    totalToProcess = count;
    console.log(`Total memories needing backfill: ${totalToProcess}`);
  }

  while (true) {
    // Fetch a batch of memories that don't have embeddings
    // We fetch one batch at a time to keep memory usage low
    const { data: batch, error: fetchError } = await supabase
      .from("memories")
      .select("id, title, body")
      .is("embedding", null)
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error(`Error fetching batch: ${fetchError.message}`);
      break;
    }

    if (!batch || batch.length === 0) {
      console.log("\nNo more memories to process.");
      break;
    }

    for (const memory of batch) {
      const textToEmbed = `${memory.title} ${memory.body}`.trim();
      if (!textToEmbed) {
        console.warn(`\n  Skipping empty memory ID: ${memory.id}`);
        continue;
      }

      const embedding = await generateEmbedding(textToEmbed);
      
      if (embedding) {
        const { error: updateError } = await supabase
          .from("memories")
          .update({ embedding })
          .eq("id", memory.id);
        
        if (updateError) {
          console.error(`\n  Error updating memory ${memory.id}: ${updateError.message}`);
        } else {
          successCount++;
          process.stdout.write(".");
        }
      } else {
        process.stdout.write("x");
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`\nProgress: ${processedCount}/${totalToProcess} processed...`);
      }
    }

    // Explicitly null out batch to help GC, though Node usually handles this
    // but in OOM situations, every bit helps.
  }

  console.log(`\n\nBackfill Summary:`);
  console.log(`- Total Processed: ${processedCount}`);
  console.log(`- Successfully Updated: ${successCount}`);
  console.log(`- Failed/Skipped: ${processedCount - successCount}`);

  console.log("\nStep 3: Verifying a sample record...");
  const { data: final, error: finalError } = await supabase
    .from("memories")
    .select("id, title, embedding")
    .not("embedding", "is", null)
    .limit(1);

  if (final && final.length > 0) {
    console.log("Verification Success:");
    console.log(" - Title:", final[0].title);
    console.log(" - Embedding length:", final[0].embedding.length);
  } else {
    console.log("Verification Failed: No memories with embeddings found.");
  }
}

fixAndBackfill().catch(err => {
  console.error("Fatal error during backfill:", err);
  process.exit(1);
});
