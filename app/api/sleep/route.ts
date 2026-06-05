import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);
  if (!user?.id || !supabase) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("sleep_tracking")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);
  if (!user?.id || !supabase) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { data, error } = await supabase
    .from("sleep_tracking")
    .insert({
      user_id: user.id,
      date: body.date || new Date().toISOString().split("T")[0],
      duration_minutes: body.duration_minutes ?? null,
      quality: body.quality ?? null,
      notes: body.notes ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
