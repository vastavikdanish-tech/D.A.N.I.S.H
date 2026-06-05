import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);

  let query = supabase
    .from("device_commands")
    .select("id, device_id, command, payload, status, result, created_at, executed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (deviceId) {
    query = query.eq("device_id", deviceId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}
