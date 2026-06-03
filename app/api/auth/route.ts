import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase.server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = body.action ?? "login";

  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json({ ok: false, error: "Supabase admin client not configured" }, { status: 500 });
  }

  try {
    const email = body.email;
    const password = body.password;
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "email and password required" }, { status: 400 });
    }

    if (action === "signup") {
      const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (signUpError || !signUpData.user) {
        return NextResponse.json({ ok: false, error: signUpError?.message || "Unable to create user." }, { status: 400 });
      }

      const signInResult = await adminClient.auth.signInWithPassword({ email, password });
      if (signInResult.error || !signInResult.data.session) {
        return NextResponse.json({ ok: false, error: signInResult.error?.message || "Unable to sign in after signup." }, { status: 500 });
      }

      const profileName = email.split("@")[0];
      // Use admin client for upserts to bypass potential RLS/permission issues on profiles
      await adminClient.from("users").upsert({ id: signUpData.user.id, email }, { onConflict: "id" });
      await adminClient.from("profiles").upsert(
        {
          id: signUpData.user.id,
          display_name: profileName,
          timezone: "UTC"
        },
        { onConflict: "id" }
      );

      return NextResponse.json(
        {
          ok: true,
          user: { id: signUpData.user.id, email: signUpData.user.email },
          session: signInResult.data.session
        },
        { status: 201 }
      );
    }

    const signInResult = await adminClient.auth.signInWithPassword({ email, password });
    if (signInResult.error || !signInResult.data.session || !signInResult.data.user) {
      return NextResponse.json({ ok: false, error: signInResult.error?.message || "Unable to sign in." }, { status: 400 });
    }

    const user = signInResult.data.user;
    const session = signInResult.data.session;
    const profileName = user.email?.split("@")[0] ?? "";

    // Ensure profile exists
    await adminClient.from("users").upsert({ id: user.id, email: user.email }, { onConflict: "id" });
    await adminClient.from("profiles").upsert(
      {
        id: user.id,
        display_name: profileName,
        timezone: "UTC"
      },
      { onConflict: "id" }
    );

    return NextResponse.json({ ok: true, session, user: { id: user.id, email: user.email } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
