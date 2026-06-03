import { NextResponse } from "next/server";
import getSupabaseServerClient from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ partner_id: z.string().uuid(), name: z.string().optional() });

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });

  const { data, error } = await supabase.from("shared_space").select("*").or(`user_a.eq.${userId},user_b.eq.${userId}`);
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

  // Validate that userId differs from partner_id
  if (userId === payload.partner_id) {
    return NextResponse.json({ ok: false, error: "Cannot create shared space with self" }, { status: 400 });
  }

  const { data, error } = await supabase.from("shared_space").insert({
    user_a: userId,
    user_b: payload.partner_id,
    name: payload.name ?? null,
    created_at: new Date().toISOString()
  }).select().single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
