import { getSupabaseAdminClient, createClient } from "./supabase.server";

/**
 * Gets the user ID from the request.
 * Priority: 
 * 1. Supabase Auth Session (via cookies)
 * 2. Authorization Bearer token (explicit)
 * 3. x-user-id header (legacy/fallback)
 */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const xUser = request.headers.get("x-user-id");

  try {
    // 1. Try session-aware client first
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;

    // 2. Try explicit Bearer token
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (authHeader) {
      const match = authHeader.match(/Bearer\s+(.*)/i);
      const token = match ? match[1] : authHeader;
      
      const adminSupabase = getSupabaseAdminClient();
      if (adminSupabase) {
        const { data } = await adminSupabase.auth.getUser(token);
        if (data?.user) return data.user.id;
      }
    }
  } catch (e) {
    console.error("Auth helper error:", e);
  }

  // 3. Fallback to header
  return xUser || null;
}

export default getUserIdFromRequest;
