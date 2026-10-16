import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Env (gracefully falls back to local dev defaults so the app compiles
// without real credentials in a fresh checkout).
// ---------------------------------------------------------------------------
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "demo-anon-key";

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "demo-service-role-key";

// ---------------------------------------------------------------------------
// Browser client — used in Client Components.
// Persists session, auto-refreshes tokens.
// ---------------------------------------------------------------------------
export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
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
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
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
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}
