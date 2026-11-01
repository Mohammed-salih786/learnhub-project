import { describe, expect, it } from "vitest";

import {
  adminCategoryCreateSchema,
  adminCategoryUpdateSchema,
  adminUserStatusUpdateSchema,
  accountRegistrationSchema,
  courseApprovalFilterSchema,
  courseRejectionSchema,
  instructorCourseUpdateSchema,
  instructorRequestSchema,
  lessonCreateSchema,
  lessonResourceSchema,
  moderationFlagSchema,
  moderationResolutionSchema,
  planWriteSchema,
  instructorVerificationSchema,
  roleTransitionSchema,
  paymentSubscribeSchema,
  paymentVerifySchema,
  payoutMarkPaidSchema
} from "./schemas";

describe("security-sensitive request schemas", () => {
  it("accepts an instructor signup without granting application approval", () => {
    expect(accountRegistrationSchema.parse({
      fullName: "Learn Hub",
      email: "teacher@example.com",
      password: "a-long-password",
      role: "instructor"
    }).role).toBe("instructor");
  });

  it("rejects attempts to assign protected account fields", () => {
    expect(accountRegistrationSchema.safeParse({
      fullName: "Learn Hub",
      email: "teacher@example.com",
      password: "a-long-password",
      role: "admin"
    }).success).toBe(false);
    expect(roleTransitionSchema.safeParse({ role: "instructor" }).success).toBe(false);
    expect(roleTransitionSchema.safeParse({ role: "student", user_id: "other-user" }).success).toBe(false);
  });

  it("requires bounded instructor application details", () => {
    expect(instructorRequestSchema.safeParse({
      bio: "I have taught product design for five years.",
      headline: "Product design instructor",
      sampleLink: "https://example.com/work"
    }).success).toBe(true);
    expect(instructorRequestSchema.safeParse({
      bio: "short",
      headline: "Instructor"
    }).success).toBe(false);
  });

  it("rejects unknown or invalid lesson and resource fields", () => {
    expect(lessonCreateSchema.safeParse({ courseId: "course-1", title: "Lesson one" }).success).toBe(true);
    expect(lessonCreateSchema.safeParse({ title: "Lesson one" }).success).toBe(false);
    expect(lessonCreateSchema.safeParse({ courseId: "course-1", course_id: "course-2" }).success).toBe(false);
    expect(lessonCreateSchema.safeParse({ courseId: "course-1", title: "Lesson one", instructor_id: "other" }).success).toBe(false);
    expect(lessonResourceSchema.safeParse({ title: "Slides", resourceType: "file", url: "/uploads/slides.pdf" }).success).toBe(true);
    expect(lessonResourceSchema.safeParse({ title: "Slides", resourceType: "admin", url: "/uploads/slides.pdf" }).success).toBe(false);
    expect(lessonResourceSchema.safeParse({ title: "Slides", resourceType: "link", url: "javascript:alert(1)" }).success).toBe(false);
  });

  it("rejects protected plan and moderation fields", () => {
    expect(planWriteSchema.safeParse({ key: "monthly", amount_cents: 14900, id: "forged" }).success).toBe(false);
    expect(moderationFlagSchema.safeParse({ targetType: "course", targetId: "course-1", reason: "A sufficiently detailed report.", status: "resolved" }).success).toBe(false);
  });

  it("allows only instructor draft or review statuses and validates admin decisions", () => {
    expect(instructorCourseUpdateSchema.safeParse({ status: "draft" }).success).toBe(true);
    expect(instructorCourseUpdateSchema.safeParse({ status: "pending_review" }).success).toBe(true);
    expect(instructorCourseUpdateSchema.safeParse({ status: "published" }).success).toBe(false);
    expect(courseApprovalFilterSchema.safeParse("pending_review").success).toBe(true);
    expect(courseApprovalFilterSchema.safeParse("unknown").success).toBe(false);
    expect(courseRejectionSchema.safeParse({ reason: "Please add a complete course outline." }).success).toBe(true);
    expect(courseRejectionSchema.safeParse({ reason: "short" }).success).toBe(false);
    expect(courseRejectionSchema.safeParse({ reason: "Please add a complete course outline.", status: "rejected" }).success).toBe(false);
  });

  it("validates admin category, account, verification, and moderation inputs strictly", () => {
    expect(adminCategoryCreateSchema.safeParse({ name: "Product Design", slug: "product-design", sort_order: 2, is_active: true }).success).toBe(true);
    expect(adminCategoryCreateSchema.safeParse({ name: "Product Design", slug: "Product Design" }).success).toBe(false);
    expect(adminCategoryUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
    expect(adminCategoryUpdateSchema.safeParse({ id: "forged" }).success).toBe(false);
    expect(adminUserStatusUpdateSchema.safeParse({ reason: "Policy violation." }).success).toBe(true);
    expect(adminUserStatusUpdateSchema.safeParse({ role: "admin" }).success).toBe(false);
    expect(instructorVerificationSchema.safeParse({ verified_badge: true }).success).toBe(true);
    expect(instructorVerificationSchema.safeParse({ verified_badge: true, role: "admin" }).success).toBe(false);
    expect(moderationResolutionSchema.safeParse({ status: "resolved", unpublishCourse: true }).success).toBe(true);
    expect(moderationResolutionSchema.safeParse({ status: "resolved", target_id: "course-1" }).success).toBe(false);
  });

  it("strictly validates payment and payout request payloads", () => {
    expect(paymentSubscribeSchema.safeParse({ planKey: "monthly" }).success).toBe(true);
    expect(paymentSubscribeSchema.safeParse({ planKey: "trial" }).success).toBe(false);
    expect(paymentSubscribeSchema.safeParse({ planKey: "monthly", amount: 1 }).success).toBe(false);
    expect(paymentVerifySchema.safeParse({
      razorpay_order_id: "order-1",
      razorpay_payment_id: "payment-1",
      razorpay_signature: "a".repeat(64)
    }).success).toBe(true);
    expect(paymentVerifySchema.safeParse({
      razorpay_order_id: "order-1",
      razorpay_payment_id: "payment-1",
      razorpay_signature: "not-a-signature"
    }).success).toBe(false);
    expect(payoutMarkPaidSchema.safeParse({ reference: "BANK-REF-001" }).success).toBe(true);
    expect(payoutMarkPaidSchema.safeParse({ reference: "BANK-REF-001", paid: true }).success).toBe(false);
  });
});
