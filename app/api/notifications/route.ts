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
    return NextResponse.json({ ok: false, error: "Supabase admin client not configured." }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, body, remind_at")
    .eq("user_id", user.id)
    .lte("remind_at", now)
    .gte("remind_at", new Date(Date.now() - 300_000).toISOString())
    .order("remind_at", { ascending: false });

  if (error) {
    console.error("Notification check error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}
