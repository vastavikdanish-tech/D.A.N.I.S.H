import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient, createClient } from "./supabase.server";

/**
 * Gets the user ID from the request.
 * Priority: 
 * 1. Supabase Auth Session (via cookies)
 * 2. Authorization Bearer token (explicit)
 * 3. x-user-id header (legacy/fallback)
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const user = await getUserFromRequest(request);
  return user?.id ?? request.headers.get("x-user-id");
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const xUser = request.headers.get("x-user-id");

  try {
    // 1. Try session-aware client first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;

    // 2. Try explicit Bearer token
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader) {
      const match = authHeader.match(/Bearer\s+(.*)/i);
      const token = match ? match[1] : authHeader;
      
      const adminSupabase = getSupabaseAdminClient();
      if (adminSupabase) {
        const { data } = await adminSupabase.auth.getUser(token);
        if (data?.user) return data.user;
      }
    }
  } catch (e) {
    console.error("Auth helper error:", e);
  }

  // 3. Legacy fallback only carries an id.
  return xUser ? ({ id: xUser } as User) : null;
}

export default getUserIdFromRequest;
