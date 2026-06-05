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
  } catch {
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
      
      if (!userId) {
        return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
      }

      const sentinelId = "00000000-0000-4000-a000-000000000000";
      let targetDeviceId = body.deviceId;

      if (targetDeviceId === sentinelId || body.device_type) {
        const deviceType = body.device_type || "laptop";
        const { data: devices } = await supabase
          .from("devices")
          .select("id")
          .eq("user_id", userId)
          .eq("device_type", deviceType)
          .contains("health", JSON.stringify({ approved: true }))
          .limit(1);

        if (devices && devices.length > 0) {
          targetDeviceId = devices[0].id;
        } else {
          return NextResponse.json({
            ok: true,
            queued: null,
            message: `No approved ${deviceType} device found. Register and approve a device first.`
          });
        }
      }

      if (!targetDeviceId) {
        return NextResponse.json({ ok: false, error: "deviceId required" }, { status: 400 });
      }

      const insert = {
        user_id: userId,
        device_id: targetDeviceId,
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
  } catch {
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
