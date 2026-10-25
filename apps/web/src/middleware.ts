import { NextRequest, NextResponse } from "next/server";

const roleHome = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin"
} as const;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const portal = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/instructor")
      ? "instructor"
      : "student";

  if (portal === "admin" && (pathname === "/admin/login" || pathname === "/admin/register")) {
    return NextResponse.next();
  }

  const session = request.cookies.get("learnhub_session")?.value;
  const role = request.cookies.get("learnhub_role")?.value as keyof typeof roleHome | undefined;
  if (!session || !role || !(role in roleHome)) {
    const login = new URL(portal === "admin" ? "/admin/login" : "/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  if (role !== portal) {
    return NextResponse.redirect(new URL(roleHome[role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/instructor/:path*", "/admin/:path*"]
};
