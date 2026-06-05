import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthenticated" }, { status: 401 });
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });
  }

  const { device_id } = await request.json().catch(() => ({}));
  if (!device_id) {
    return NextResponse.json({ ok: false, error: "device_id required" }, { status: 400 });
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id, user_id, health")
    .eq("id", device_id)
    .single();

  if (fetchError || !device) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  if (device.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Device does not belong to you" }, { status: 403 });
  }

  const currentHealth = (device.health as Record<string, unknown>) || {};
  const updatedHealth = { ...currentHealth, approved: true };

  const { data, error } = await supabase.from("devices").update({
    status: "online",
    health: updatedHealth,
    last_seen_at: new Date().toISOString(),
  }).eq("id", device_id).select("id, name, status, device_type, health").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
