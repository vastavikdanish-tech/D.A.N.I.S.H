import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";
import { verifyPairingToken } from "@/lib/tokens";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();
  const { name, device_type, pairing_token } = await request.json().catch(() => ({}));

  if (!name || !device_type) {
    return NextResponse.json({ ok: false, error: "name and device_type required" }, { status: 400 });
  }

  let userId: string | null = null;

  // 1. Try pairing token (agent flow)
  if (pairing_token) {
    const verified = await verifyPairingToken(pairing_token);
    if (!verified) {
      return NextResponse.json({ ok: false, error: "Invalid or expired pairing token. Generate a new one from the dashboard." }, { status: 401 });
    }
    userId = verified.userId;
  } else {
    // 2. Try browser session (dashboard flow)
    const user = await getUserFromRequest(request);
    userId = user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthenticated. Provide a pairing_token or authenticate via the dashboard." }, { status: 401 });
  }

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase admin client not configured." }, { status: 500 });
  }

  const pairingCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const deviceKey = crypto.randomUUID();

  const { data, error } = await supabase.from("devices").insert({
    user_id: userId,
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
