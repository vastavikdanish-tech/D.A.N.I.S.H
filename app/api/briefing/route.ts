import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const userId = await getUserIdFromRequest(request);

  if (!userId || !supabase) {
    return NextResponse.json({ ok: true, data: { greeting: "Welcome", reminders: 0, goals: 0, devices: 0 } });
  }

  const today = new Date().toISOString().split("T")[0];
  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";

  const [{ data: reminders }, { data: goals }, { data: devices }] = await Promise.all([
    supabase.from("reminders").select("id,title,due_at").eq("user_id", userId).gte("due_at", today).lte("due_at", today + "T23:59:59.999Z").limit(5),
    supabase.from("relationship_goals").select("id,title,progress").eq("user_id", userId).limit(5),
    supabase.from("devices").select("id,name,health").eq("user_id", userId).limit(10),
  ]);

  const onlineDevices = (devices || []).filter((d: Record<string, unknown>) => (d.health as Record<string, unknown>)?.status === "online");

  const upNext = (reminders || []).sort(
    (a: Record<string, string>, b: Record<string, string>) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
  ).slice(0, 3);

  const goalProgress = (goals || []).map((g: Record<string, unknown>) => ({
    title: g.title,
    progress: typeof g.progress === "number" ? g.progress : 0,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      greeting,
      reminders: reminders?.length || 0,
      upNext,
      goals: goalProgress,
      devicesOnline: onlineDevices.length,
      devicesTotal: devices?.length || 0,
    },
  });
}
