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
    return NextResponse.json({ ok: false, error: "Supabase admin client not configured." }, { status: 500 });
  }

  const { name, device_type } = await request.json().catch(() => ({}));

  if (!name || !device_type) {
    return NextResponse.json({ ok: false, error: "name and device_type required" }, { status: 400 });
  }

  const pairingCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const deviceKey = crypto.randomUUID();

  const { data, error } = await supabase.from("devices").insert({
    user_id: user.id,
    name,
    device_type,
    status: "pending",
    health: { pairingCode, deviceKey },
    last_seen_at: new Date().toISOString(),
  }).select("id, name, device_type, status, health, last_seen_at").single();

  if (error) {
    console.error("Device registration error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    data: data,
    pairingCode,
    deviceKey,
  });
}
