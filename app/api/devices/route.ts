import { NextResponse } from "next/server";
import { devices as mockDevices } from "@/data/dashboard";
import getSupabaseServerClient from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.from("devices").select("*").limit(100);
      if (!error && data) {
        return NextResponse.json({ ok: true, data });
      }
    }
  } catch (e) {
    // fallthrough to mock
  }

  return NextResponse.json({
    ok: true,
    data: mockDevices,
    architecture: {
      desktopClient: "Future Electron/Tauri client exposes a signed command bridge.",
      realtime: "Supabase Realtime channel device:{userId} streams health and command state.",
      safety: "Every destructive action requires explicit user confirmation and audit logging."
    }
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const userId = await getUserIdFromRequest(request);
      
      if (!userId || !body.deviceId) {
        return NextResponse.json({ ok: false, error: "userId and deviceId required" }, { status: 400 });
      }
      
      // Validate deviceId is UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(body.deviceId)) {
        return NextResponse.json({ ok: false, error: "deviceId must be a valid UUID" }, { status: 400 });
      }
      
      const insert = {
        user_id: userId,
        device_id: body.deviceId,
        command: body.action ?? "open_app",
        payload: body.payload ?? {},
        status: "queued",
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase.from("device_commands").insert(insert).select();
      if (!error && data) {
        return NextResponse.json({ ok: true, queued: data[0] });
      }
    }
  } catch (e) {
    // fallback to mock response
  }

  return NextResponse.json({
    ok: true,
    queued: {
      id: crypto.randomUUID(),
      deviceId: body.deviceId ?? "laptop",
      action: body.action ?? "open_app",
      status: "queued",
      createdAt: new Date().toISOString()
    }
  });
}
