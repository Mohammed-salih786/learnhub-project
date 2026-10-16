import { z } from "zod";

import { roleChoiceSchema, roleSchema } from "@learnhub/shared";

export const loginSchema = z.object({
  method: z.enum(["phone-otp", "email-otp", "google"]),
  phone: z.string().min(10).max(25).optional(),
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(120).optional(),
  role: z.enum(["student", "instructor", "admin"]).optional()
}).refine(
  (values) => {
    if (values.method === "phone-otp") {
      return !!values.phone;
    }
    if (values.method === "email-otp") {
      return !!values.email;
    }
    if (values.method === "google") {
      return !!values.email || !!values.fullName;
    }
    return true;
  },
  {
    message: "Phone, email, or full name is required for the selected auth method.",
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
  return ["/student", "/instructor", "/admin"].some((route) => pathname.startsWith(route));
}

export function getRequiredRole(pathname: string): "student" | "instructor" | "admin" | null {
  if (pathname.startsWith("/student")) return "student";
  if (pathname.startsWith("/instructor")) return "instructor";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export type RouteRole = z.infer<typeof roleSchema>;
