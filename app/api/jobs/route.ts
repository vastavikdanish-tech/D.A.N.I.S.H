import { NextResponse } from "next/server";
import getSupabaseServerClient from "@/lib/supabase.server";
import { getUserIdFromRequest } from "@/lib/auth";

const mockJobs = [
  { id: "1", title: "Python Developer Intern - Cognifyz", company: "Cognifyz", location: "Remote", url: "https://example.com/job/1" },
  { id: "2", title: "Backend Intern - Internshala", company: "Internshala", location: "India", url: "https://example.com/job/2" },
  { id: "3", title: "Python Intern - ZithCode", company: "ZithCode", location: "Remote", url: "https://example.com/job/3" }
];

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      // No dedicated jobs table in schema; return mock jobs for now
      return NextResponse.json({ ok: true, data: mockJobs });
    }
  } catch {
    // fallback
  }

  return NextResponse.json({ ok: true, data: mockJobs });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const userId = await getUserIdFromRequest(request);
      // save job to memories as a career item
      const mem = {
        user_id: userId ?? null,
        category: "career",
        title: body.title ?? "Untitled Job",
        body: JSON.stringify(body),
        tags: body.tags ?? []
      };
      const { data, error } = await supabase.from("memories").insert(mem).select();
      if (!error && data) return NextResponse.json({ ok: true, data: data[0] }, { status: 201 });
    }
  } catch {
    // fallback to echo
  }

  return NextResponse.json({ ok: true, data: { id: crypto.randomUUID(), ...body } }, { status: 201 });
}
