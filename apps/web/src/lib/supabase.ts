import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Read environment values without placing credentials in client bundles.
// ---------------------------------------------------------------------------
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function getMissingSupabaseEnvironment(includeServiceRole = true) {
  const required = [
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey],
    ...(includeServiceRole ? [["SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey] as const] : [])
  ] as const;

  return required.filter(([, value]) => !value.trim()).map(([name]) => name);
}

function requireSupabaseEnvironment(includeServiceRole = true) {
  const missing = getMissingSupabaseEnvironment(includeServiceRole);
  if (missing.length) {
    throw new Error(
      `Supabase configuration missing: ${missing.join(", ")}. Add these values in the Vercel project environment settings and redeploy.`
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase project URL.");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS in production.");
  }

  return { url: supabaseUrl, anonKey: supabaseAnonKey, serviceRoleKey: supabaseServiceRoleKey };
}

// ---------------------------------------------------------------------------
// Browser client — used in Client Components.
// Persists session, auto-refreshes tokens.
// ---------------------------------------------------------------------------
export function createBrowserSupabaseClient() {
  const config = requireSupabaseEnvironment(false);
  return createBrowserClient(config.url, config.anonKey);
}

// Singleton for client-side usage
let browserClient: ReturnType<typeof createBrowserSupabaseClient> | null = null;
export function getBrowserSupabaseClient() {
  if (!browserClient) {
    browserClient = createBrowserSupabaseClient();
  }
  return browserClient;
}

// ---------------------------------------------------------------------------
// Server client — used in Route Handlers and Server Actions.
// Uses service role key so it bypasses RLS when needed.
// NEVER expose this to the browser.
// ---------------------------------------------------------------------------
export function createServerSupabaseClient() {
  const config = requireSupabaseEnvironment();
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

// ---------------------------------------------------------------------------
// Anon server client — for server-side reads that respect RLS
// ---------------------------------------------------------------------------
export function createAnonServerSupabaseClient() {
  const config = requireSupabaseEnvironment(false);
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
