import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getRequiredRole, isRoleProtectedRoute } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isRoleProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const userRole = request.cookies.get("learnhub_role")?.value ?? "";
  const roleForProfileApi =
    pathname === "/api/profile" && ["student", "instructor", "admin"].includes(userRole)
      ? (userRole as "student" | "instructor" | "admin")
      : null;
  const requiredRole = getRequiredRole(pathname) ?? roleForProfileApi;
  const sessionId = request.cookies.get("learnhub_session")?.value ?? "";
  const isApiRequest = pathname.startsWith("/api/");

  if (!requiredRole || !sessionId || userRole !== requiredRole) {
    if (isApiRequest) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const isLocalDemo =
    process.env.NODE_ENV !== "production" &&
    supabaseUrl.includes("localhost") &&
    sessionId.startsWith("demo-");
  let isAuthorized = isLocalDemo;

  if (!isAuthorized && supabaseUrl && anonKey && serviceRoleKey) {
    try {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data, error } = await authClient.auth.getUser(sessionId);
      isAuthorized = false;

      if (!error && data.user) {
        const databaseClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });
        const { data: profile, error: profileError } = await databaseClient
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();
        isAuthorized = !profileError && profile?.role === requiredRole;

        if (isAuthorized && requiredRole === "admin") {
          const allowedAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          isAuthorized = !!allowedAdminEmail &&
            data.user.email?.trim().toLowerCase() === allowedAdminEmail;
        }
      }
    } catch {
      isAuthorized = false;
    }
  }

  if (!isAuthorized) {
    if (isApiRequest) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/student/:path*",
    "/instructor/:path*",
    "/admin/:path*",
    "/api/student/:path*",
    "/api/instructor/:path*",
    "/api/admin/:path*",
    "/api/profile"
  ]
};
