/**
 * Session helpers — extracts the real Supabase user ID from the JWT stored
 * in the learnhub_session cookie.
 *
 * Why we store the JWT in a cookie (instead of Supabase's own cookie):
 * - We need httpOnly cookies so JS can't read/steal them.
 * - @supabase/ssr handles cookie management automatically for the Supabase session,
 *   but for Next.js Route Handlers we need a simple, explicit approach.
 *
 * The JWT sub claim IS the user's UUID in Supabase Auth.
 * We decode (not verify) it here because the Supabase service-role client
 * will reject any DB query with an invalid userId anyway, and the middleware
 * does the full cryptographic verification.
 */

import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "./supabase";

const IS_LOCAL_DEV =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost") === true;

interface SessionInfo {
  userId: string;
  role: string;
}

/**
 * Decode (not verify) a JWT to extract the payload.
 * Verification happens either in middleware (full) or implicitly when Supabase
 * rejects a query for a non-existent userId.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url decode
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

/**
 * Get the authenticated user's ID and role from the request.
 * Returns null if the session is missing or invalid.
 *
 * In local dev: the cookie stores "demo-${timestamp}" which is not a real UUID.
 * We treat any non-empty value as valid and return a fake UUID so DB queries
 * can be tested against a real local Supabase instance.
 */
export function getSessionFromRequest(request: NextRequest): SessionInfo | null {
  const token = request.cookies.get("learnhub_session")?.value ?? "";
  const role = request.cookies.get("learnhub_role")?.value ?? "student";

  if (!token) return null;

  // Local dev: token is "demo-{timestamp}" — not a real JWT
  if (IS_LOCAL_DEV || token.startsWith("demo-")) {
    // Return a stable fake UUID for local dev so DB queries don't crash
    return { userId: "00000000-0000-0000-0000-000000000001", role };
  }

  // Production: token is a real Supabase JWT — decode to get `sub` (= user UUID)
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== "string") return null;

  // Check expiry
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
    return null; // Expired
  }

  return { userId: payload.sub, role };
}

/**
 * Verify the session by actually querying Supabase for the user's profile.
 * More expensive than `getSessionFromRequest` — use only where security matters.
 */
export async function verifySessionFromRequest(
  request: NextRequest
): Promise<SessionInfo | null> {
  const session = getSessionFromRequest(request);
  if (!session) return null;

  if (IS_LOCAL_DEV) return session;

  const db = createServerSupabaseClient();
  const { data } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", session.userId)
    .single();

  if (!data) return null;
  return { userId: data.id, role: data.role };
}
