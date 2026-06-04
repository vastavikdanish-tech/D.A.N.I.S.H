import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, or Server Actions.
 * This client uses the user's session cookies by default, which is necessary for RLS to work.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Creates a Supabase client with the service role key to bypass RLS.
 * USE WITH CAUTION. This should only be used for administrative tasks.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing Supabase admin environment variables");
    return null;
  }

  // Admin client doesn't need cookies as it bypasses RLS.
  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Deprecated: Use createClient() instead for user-aware requests
export function getSupabaseServerClient(): SupabaseClient | null {
  console.warn("getSupabaseServerClient is deprecated. Use createClient() instead.");
  return getSupabaseAdminClient();
}

export default getSupabaseServerClient;
