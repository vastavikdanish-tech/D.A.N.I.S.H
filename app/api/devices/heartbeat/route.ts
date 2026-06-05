import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });
  }

  const { device_id, device_key } = await request.json().catch(() => ({}));
  if (!device_id || !device_key) {
    return NextResponse.json({ ok: false, error: "device_id and device_key required" }, { status: 400 });
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id, health, status")
    .eq("id", device_id)
    .single();

  if (fetchError || !device) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  const health = device.health as { deviceKey?: string } | null;
  if (health?.deviceKey !== device_key) {
    return NextResponse.json({ ok: false, error: "Invalid device key" }, { status: 403 });
  }

  const { data, error } = await supabase.from("devices").update({
    status: "online",
    last_seen_at: new Date().toISOString(),
  }).eq("id", device_id).select("id, name, status, last_seen_at").single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
