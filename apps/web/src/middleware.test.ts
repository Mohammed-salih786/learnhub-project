import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function request(path: string, cookies: Record<string, string> = {}) {
  const result = new NextRequest(`http://localhost${path}`);
  Object.entries(cookies).forEach(([key, value]) => result.cookies.set(key, value));
  return result;
}

describe("role middleware", () => {
  it("redirects unauthenticated students to login", () => {
    const response = middleware(request("/student"));
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects students away from instructor routes", () => {
    const response = middleware(request("/instructor", { learnhub_session: "token", learnhub_role: "student" }));
    expect(response.headers.get("location")).toContain("/student");
  });

  it("allows an authenticated student into the student portal", () => {
    expect(middleware(request("/student", { learnhub_session: "token", learnhub_role: "student" })).status).toBe(200);
  });
});
