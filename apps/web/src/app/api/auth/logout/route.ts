import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of ["learnhub_session", "learnhub_role"]) {
    response.cookies.set(name, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0
    });
  }
  return response;
}
