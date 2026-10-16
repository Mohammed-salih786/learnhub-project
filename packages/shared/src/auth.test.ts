import { describe, expect, it } from "vitest";

import { canSetRoleOnFirstLogin, normalizeRole, validatePhoneNumber, validateRoleChoice } from "./auth";
import { adminOverviewSchema, courseDraftSchema, moderationReviewSchema } from "./schemas";

describe("role validation", () => {
  it("accepts supported roles", () => {
    expect(normalizeRole("INSTRUCTOR")).toBe("instructor");
    expect(normalizeRole("student")).toBe("student");
  });

  it("requires first-login role choice", () => {
    expect(canSetRoleOnFirstLogin(null)).toBe(true);
    expect(canSetRoleOnFirstLogin("student")).toBe(false);
  });

  it("validates phone numbers", () => {
    expect(validatePhoneNumber("+919876543210")).toBe(true);
    expect(validatePhoneNumber("123")).toBe(false);
  });

  it("parses role choice payloads", () => {
    const payload = {
      role: "student",
      authProvider: "phone-otp",
      phone: "+919876543210"
    };

    expect(validateRoleChoice(payload)).toEqual(payload);
  });

  it("validates instructor course drafts", () => {
    const payload = {
      title: "Product design fundamentals",
      slug: "product-design-fundamentals",
      category: "Design",
      shortDescription: "A beginner-friendly course on course design and UX systems.",
      description: "This course introduces practical design thinking, UI patterns, and rapid prototyping for modern product teams.",
      priceCents: 29900,
      status: "draft"
    } as const;

    expect(courseDraftSchema.parse(payload)).toEqual(payload);
  });

  it("validates admin metrics and moderation review payloads", () => {
    const overview = {
      totalSubscribers: 8200,
      activeInstructors: 214,
      pendingReviews: 18,
      revenueCents: 360000,
      conversionRate: 4.8,
      churnRate: 2.1
    };

    const review = {
      reviewer: "Ananya Shah",
      courseTitle: "AI Workflow Playbooks",
      reason: "The course content has misleading claims about certification outcomes.",
      severity: "high",
      status: "pending"
    } as const;

    expect(adminOverviewSchema.parse(overview)).toEqual(overview);
    expect(moderationReviewSchema.parse(review)).toEqual(review);
  });
});
