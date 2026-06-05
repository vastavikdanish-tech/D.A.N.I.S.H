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
    .from("study_tracking")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
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
    .from("study_tracking")
    .insert({
      user_id: user.id,
      subject: body.subject || "General",
      duration_minutes: body.duration_minutes || 30,
      notes: body.notes || null,
      date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
