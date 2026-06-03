import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase.server";

const memoryCreateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.enum(["personal", "study", "relationship", "goal", "conversation", "note", "career", "preference", "project"]),
  importance: z.number().min(1).max(10).optional(),
  tags: z.array(z.string()).optional(),
  shared_with: z.array(z.string()).optional()
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Missing or unauthenticated user." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  // Fetch memories using RLS. 
  // We still add the filter for performance and to handle shared memories explicitly if needed.
  let query = supabase
    .from("memories")
    .select("id,user_id,category,title,body,importance,tags,shared_with,created_at")
    .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  
  if (error) {
    console.error("Memories fetch error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Missing or unauthenticated user." }, { status: 401 });
  }

  const json = await request.json();
  const payload = memoryCreateSchema.parse(json);

  // Validate shared_with contains only UUIDs if provided
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (payload.shared_with && !payload.shared_with.every((id: string) => uuidRegex.test(id))) {
    return NextResponse.json({ ok: false, error: "shared_with must contain valid UUIDs" }, { status: 400 });
  }

  const { data, error } = await supabase.from("memories").insert({
    user_id: user.id,
    category: payload.category,
    title: payload.title,
    body: payload.body,
    importance: payload.importance ?? 5,
    tags: payload.tags ?? [],
    shared_with: payload.shared_with ?? [],
    created_at: new Date().toISOString()
  }).select().single();

  if (error) {
    console.error("Memory creation error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
