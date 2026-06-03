import { NextResponse } from "next/server";
import getSupabaseServerClient from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ date: z.string().optional(), sleep_hours: z.number().optional(), food: z.any().optional(), water_ml: z.number().optional(), mood: z.string().optional(), notes: z.string().optional() });

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  const supabase = getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  let query = supabase.from("health_tracking").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  if (date) query = query.eq("date", date);

  const { data, error } = await query;
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

  const { data, error } = await supabase.from("health_tracking").insert({
    user_id: userId,
    date: payload.date ?? new Date().toISOString().slice(0, 10),
    sleep_hours: payload.sleep_hours ?? null,
    food: payload.food ?? null,
    water_ml: payload.water_ml ?? null,
    mood: payload.mood ?? null,
    notes: payload.notes ?? null,
    created_at: new Date().toISOString()
  }).select().single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
