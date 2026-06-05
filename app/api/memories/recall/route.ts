import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ai";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id || !supabase) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { query } = await request.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ ok: false, error: "query string required" }, { status: 400 });
  }

  const embedding = await generateEmbedding(query);

  const { data: memories, error: memError } = await supabase.rpc("match_memories", {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 10,
    p_user_id: user.id,
  });

  if (!memError && memories) {
    return NextResponse.json({ ok: true, data: memories });
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from("memories")
    .select("id,title,body,category,tags,importance,created_at")
    .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
    .textSearch("body", query, { config: "english" })
    .limit(10);

  if (fallbackError) {
    return NextResponse.json({ ok: true, data: [], message: "No matching memories found." });
  }

  return NextResponse.json({ ok: true, data: fallback });
}
