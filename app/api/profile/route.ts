import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase.server";
import { getUserFromRequest } from "@/lib/auth";

const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  timezone: z.string().max(50).optional(),
  avatar_url: z.string().url().optional().nullable(),
});

export async function GET(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Missing or unauthenticated user." }, { status: 401 });
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase admin client not configured." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, timezone, bio, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ ok: false, error: "Profile not found." }, { status: 404 });
    }
    console.error("Profile fetch error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}

export async function PATCH(request: Request) {
  const supabase = getSupabaseAdminClient();
  const user = await getUserFromRequest(request);

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Missing or unauthenticated user." }, { status: 401 });
  }
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase admin client not configured." }, { status: 500 });
  }

  const json = await request.json().catch(() => ({}));
  const payload = profileUpdateSchema.parse(json);

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ ok: false, error: "No valid fields provided for update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id, display_name, avatar_url, timezone, bio, created_at, updated_at")
    .single();

  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}