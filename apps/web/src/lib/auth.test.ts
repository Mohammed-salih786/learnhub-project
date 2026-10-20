import { describe, expect, it } from "vitest";

import { getRequiredRole, isRoleProtectedRoute, validateLoginAttempt } from "./auth";

describe("LearnHub auth routing", () => {
  it.each([
    ["/student", "student"],
    ["/api/student/progress", "student"],
    ["/instructor/courses", "instructor"],
    ["/api/instructor/courses", "instructor"],
    ["/admin", "admin"],
    ["/api/admin/plans", "admin"]
  ])("maps %s to the %s role", (pathname, role) => {
    expect(isRoleProtectedRoute(pathname)).toBe(true);
    expect(getRequiredRole(pathname)).toBe(role);
  });

  it("keeps public routes outside role protection", () => {
    expect(isRoleProtectedRoute("/login")).toBe(false);
    expect(getRequiredRole("/login")).toBeNull();
    expect(isRoleProtectedRoute("/api/profile")).toBe(true);
  });

  it("accepts the supported OTP methods and rejects the unfinished Google flow", () => {
    expect(validateLoginAttempt({ method: "email-otp", email: "learner@example.com" }).method)
      .toBe("email-otp");
    expect(() => validateLoginAttempt({ method: "google", email: "learner@example.com" }))
      .toThrow();
  });
});
