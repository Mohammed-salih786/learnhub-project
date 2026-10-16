import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { createDatabaseClient } from "./supabase";

const swachhRoleSchema = z.enum([
  "city_commissioner",
  "waste_manager",
  "health_officer",
  "supervisor",
]);

export type SwachhRole = z.infer<typeof swachhRoleSchema>;

export interface SwachhUser {
  userId: string;
  role: SwachhRole | null;
}

export async function getSwachhUser(
  request: NextRequest,
): Promise<SwachhUser | null> {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }
  if (!accessToken) return null;

  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) return null;

  const db = createDatabaseClient();
  const { data: assignment, error: roleError } = await db
    .from("swachh_user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (roleError) throw roleError;
  const role = assignment ? swachhRoleSchema.parse(assignment.role) : null;

  return {
    userId: data.user.id,
    role,
  };
}
