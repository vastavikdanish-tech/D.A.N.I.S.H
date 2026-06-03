import { NextResponse } from "next/server";
import getSupabaseServerClient from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ title: z.string().min(1), body: z.string().optional(), remind_at: z.string().optional(), recurring: z.string().optional(), shared: z.boolean().optional(), shared_with: z.array(z.string()).optional() });

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });

  const { data, error } = await supabase.from("reminders").select("*").or(`user_id.eq.${userId},shared_with.cs.{${userId}}`).order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });

  const json = await request.json();
  const payload = schema.parse(json);

  // Validate shared_with contains only UUIDs if provided
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (payload.shared_with && !payload.shared_with.every((id: string) => uuidRegex.test(id))) {
    return NextResponse.json({ ok: false, error: "shared_with must contain valid UUIDs" }, { status: 400 });
  }

  const { data, error } = await supabase.from("reminders").insert({
    user_id: userId,
    title: payload.title,
    body: payload.body ?? null,
    remind_at: payload.remind_at ?? null,
    recurring: payload.recurring ?? null,
    shared: payload.shared ?? false,
    shared_with: payload.shared_with ?? [],
    created_at: new Date().toISOString()
  }).select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
