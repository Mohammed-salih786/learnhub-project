import { z } from "zod";

import { roleChoiceSchema, roleSchema } from "@learnhub/shared";

export const loginSchema = z.object({
  method: z.enum(["phone-otp", "email-otp"]),
  phone: z.string().min(10).max(25).optional(),
  email: z.string().email().optional(),
  role: z.enum(["student", "instructor", "admin"]).optional()
}).refine(
  (values) => {
    if (values.method === "phone-otp") {
      return !!values.phone;
    }
    return !!values.email;
  },
  {
    message: "Phone or email is required for the selected auth method.",
    path: ["phone"]
  }
);

export function validateLoginAttempt(payload: unknown) {
  return loginSchema.parse(payload);
}

export function validateRoleSelection(payload: unknown) {
  const parsed = roleChoiceSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue: { message: string }) => issue.message).join(", "));
  }

  return parsed.data;
}

export function isRoleProtectedRoute(pathname: string): boolean {
  return ["/student", "/instructor", "/admin", "/api/student", "/api/instructor", "/api/admin", "/api/profile"]
    .some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getRequiredRole(pathname: string): "student" | "instructor" | "admin" | null {
  if (pathname.startsWith("/student") || pathname.startsWith("/api/student")) return "student";
  if (pathname.startsWith("/instructor") || pathname.startsWith("/api/instructor")) return "instructor";
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) return "admin";
  return null;
}

export type RouteRole = z.infer<typeof roleSchema>;
