import { NextResponse } from "next/server";
import { automations as mockAutomations } from "@/data/dashboard";
import getSupabaseServerClient from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.from("automations").select("*").limit(100);
      if (!error && data) return NextResponse.json({ ok: true, data });
    }
  } catch {
    // fallback
  }

  return NextResponse.json({ ok: true, data: mockAutomations });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const payload = {
        user_id: (await getUserIdFromRequest(request)) ?? null,
        title: body.title ?? "Untitled Workflow",
        description: body.description ?? null,
        trigger: body.trigger ?? {},
        steps: body.steps ?? [],
        enabled: Boolean(body.enabled ?? true)
      };

      const { data, error } = await supabase.from("automations").insert(payload).select();
      if (!error && data) return NextResponse.json({ ok: true, data: data[0] }, { status: 201 });
    }
  } catch {
    // fallback
  }

  return NextResponse.json(
    {
      ok: true,
      data: {
        id: crypto.randomUUID(),
        title: body.title ?? "Untitled Workflow",
        trigger: body.trigger ?? "IF condition is met",
        action: body.action ?? "THEN notify user",
        enabled: Boolean(body.enabled ?? true),
        createdAt: new Date().toISOString()
      }
    },
    { status: 201 }
  );
}
