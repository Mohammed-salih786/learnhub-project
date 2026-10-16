import { z } from "zod";

import { roleChoiceSchema, type Role, roleSchema } from "./schemas";

export function normalizeRole(value: unknown): Role {
  if (typeof value !== "string") {
    throw new Error("Role value must be a string.");
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "instructor" || normalized === "student") {
    return normalized;
  }

  throw new Error(`Unsupported role: ${value}`);
}

export function validateRoleChoice(payload: unknown) {
  const parsed = roleChoiceSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(", "));
  }
  return parsed.data;
}

export function canSetRoleOnFirstLogin(existingRole: Role | null | undefined): boolean {
  return !existingRole;
}

export function canEditOwnProfile(existingRole: Role | undefined, requestedRole: Role): boolean {
  if (!existingRole) {
    return false;
  }

  return existingRole === requestedRole;
}

export function validatePhoneNumber(phone: string): boolean {
  return /^\+?[0-9\s()-]{10,20}$/.test(phone.trim());
}
