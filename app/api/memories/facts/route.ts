import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ai";

const factSchema = z.object({
  body: z.string().min(1),
  category: z.enum(["fact", "preference"]),
  tags: z.array(z.string()).optional(),
  importance: z.number().min(1).max(10).optional(),
});

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id || !supabase) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  let query = supabase
    .from("memories")
    .select("id,title,body,category,tags,importance,created_at")
    .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
    .contains("tags", ["fact"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (category === "preference") {
    query = supabase
      .from("memories")
      .select("id,title,body,category,tags,importance,created_at")
      .eq("category", "preference")
      .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
      .order("created_at", { ascending: false })
      .limit(100);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id || !supabase) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const payload = factSchema.parse(json);

  const title = payload.body.length > 80 ? payload.body.slice(0, 80) + "..." : payload.body;
  const embedding = await generateEmbedding(payload.body);
  const tags = [...(payload.tags ?? []), "fact"];
  const category = payload.category === "preference" ? "preference" : "note";

  const { data, error } = await supabase.from("memories").insert({
    user_id: user.id,
    category,
    title,
    body: payload.body,
    importance: payload.importance ?? 5,
    tags,
    embedding,
    created_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
