import { NextRequest, NextResponse } from "next/server";

import { getRequiredRole, isRoleProtectedRoute } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isRoleProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  const requiredRole = getRequiredRole(pathname);
  const userRole = request.cookies.get("learnhub_role")?.value ?? "";
  const sessionId = request.cookies.get("learnhub_session")?.value ?? "";

  if (!requiredRole || !sessionId || userRole !== requiredRole) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/instructor/:path*", "/admin/:path*"]
};
