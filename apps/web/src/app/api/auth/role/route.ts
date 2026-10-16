import { NextRequest, NextResponse } from "next/server";

import { validateRoleSelection } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  try {
    const payload = validateRoleSelection(body);
    const response = NextResponse.json({
      ok: true,
      role: payload.role,
      authProvider: payload.authProvider,
      profile: {
        fullName: payload.fullName ?? "Learner",
        email: payload.email ?? "learner@learnhub.dev",
        phone: payload.phone ?? "+919999999999"
      }
    });

    response.cookies.set("learnhub_role", payload.role, { path: "/", httpOnly: true, sameSite: "lax" });
    return response;
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Invalid role selection."
    }, { status: 400 });
  }
}
