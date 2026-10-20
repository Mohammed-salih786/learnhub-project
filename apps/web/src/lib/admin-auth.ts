import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function getAdminUser(request: NextRequest): Promise<{ id: string | null } | null> {
  if (request.cookies.get("learnhub_role")?.value !== "admin") return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sessionToken = request.cookies.get("learnhub_session")?.value;
  if (!supabaseUrl || !anonKey || !sessionToken) return null;

  // Demo sessions are only accepted against a local Supabase instance.
  if (process.env.NODE_ENV !== "production" && supabaseUrl.includes("localhost")) {
    return sessionToken.startsWith("demo-") ? { id: null } : null;
  }

  const allowedAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedAdminEmail) return null;

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const { data, error } = await supabase.auth.getUser(sessionToken);

  if (error || data.user?.email?.trim().toLowerCase() !== allowedAdminEmail) return null;
  return { id: data.user.id };
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return (await getAdminUser(request)) !== null;
}
