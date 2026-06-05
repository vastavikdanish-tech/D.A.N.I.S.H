import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("device_id");
  const deviceKey = url.searchParams.get("device_key");

  if (!deviceId || !deviceKey) {
    return NextResponse.json({ ok: false, error: "device_id and device_key required" }, { status: 400 });
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id, health, status")
    .eq("id", deviceId)
    .single();

  if (fetchError || !device) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  const health = device.health as { deviceKey?: string } | null;
  if (health?.deviceKey !== deviceKey) {
    return NextResponse.json({ ok: false, error: "Invalid device key" }, { status: 403 });
  }

  if (device.status !== "online") {
    return NextResponse.json({ ok: true, data: [] });
  }

  const { data, error } = await supabase
    .from("device_commands")
    .select("id, command, payload, status, created_at")
    .eq("device_id", deviceId)
    .in("status", ["queued"])
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase unavailable" }, { status: 500 });
  }

  const { command_id, device_id, device_key, status, result } = await request.json().catch(() => ({}));
  if (!command_id || !device_id || !device_key || !status) {
    return NextResponse.json({ ok: false, error: "command_id, device_id, device_key, and status required" }, { status: 400 });
  }

  const { data: device, error: fetchError } = await supabase
    .from("devices")
    .select("id, health")
    .eq("id", device_id)
    .single();

  if (fetchError || !device) {
    return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  }

  const health = device.health as { deviceKey?: string } | null;
  if (health?.deviceKey !== device_key) {
    return NextResponse.json({ ok: false, error: "Invalid device key" }, { status: 403 });
  }

  const validStatuses = ["executed", "failed", "rejected"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ ok: false, error: `status must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const { data, error } = await supabase.from("device_commands").update({
    status,
    result: result ?? null,
    executed_at: new Date().toISOString(),
  }).eq("id", command_id).eq("device_id", device_id).select().single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

