import { z } from "zod";

export const roleSchema = z.enum(["student", "instructor", "admin"]);
export const planKeySchema = z.enum(["trial", "monthly", "yearly"]);
export const authProviderSchema = z.enum(["phone-otp", "email-otp", "google"]);

export const roleChoiceSchema = z.object({
  role: roleSchema,
  authProvider: authProviderSchema,
  phone: z.string().min(10).max(20).optional(),
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(120).optional()
});

export const profileSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  role: roleSchema,
  avatarUrl: z.string().url().optional(),
  isVerified: z.boolean().default(false),
  trialStartsAt: z.string().datetime().optional(),
  trialEndsAt: z.string().datetime().optional(),
  freeCourseCount: z.number().int().nonnegative().default(0)
});

export const lessonEntitlementSchema = z.object({
  isPreview: z.boolean().default(false),
  isPaidLesson: z.boolean().default(false),
  hasActiveSubscription: z.boolean().default(false),
  hasActiveTrial: z.boolean().default(false),
  freeCoursesConsumed: z.number().int().nonnegative().default(0),
  freeCourseLimit: z.number().int().nonnegative().default(2),
  userRole: roleSchema.optional()
});

export const enrollmentStatusSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
  enrolled: z.boolean().default(false),
  completionPercent: z.number().int().min(0).max(100).default(0),
  activePlan: z.enum(["trial", "monthly", "yearly"]).optional(),
  hasAccess: z.boolean().default(false)
});

export const adminOverviewSchema = z.object({
  totalSubscribers: z.number().int().nonnegative(),
  activeInstructors: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  revenueCents: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(100),
  churnRate: z.number().min(0).max(100)
});

export const moderationReviewSchema = z.object({
  reviewer: z.string().min(2).max(80),
  courseTitle: z.string().min(2).max(120),
  reason: z.string().min(10).max(240),
  severity: z.enum(["low", "medium", "high"]),
  status: z.enum(["pending", "approved", "rejected"]).default("pending")
});

export const courseDraftSchema = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().min(3).max(80),
  category: z.string().min(2).max(60),
  shortDescription: z.string().min(20).max(220),
  description: z.string().min(50).max(2000),
  priceCents: z.number().int().nonnegative().default(0),
  status: z.enum(["draft", "published"]).default("draft")
});

export const lessonDraftSchema = z.object({
  title: z.string().min(3).max(120),
  module: z.string().min(2).max(80),
  durationMinutes: z.number().int().min(1).max(240),
  summary: z.string().min(20).max(500),
  isPreview: z.boolean().default(false),
  isPaid: z.boolean().default(false)
});

export type Role = z.infer<typeof roleSchema>;
export type AuthProvider = z.infer<typeof authProviderSchema>;
export type RoleChoice = z.infer<typeof roleChoiceSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type LessonEntitlement = z.infer<typeof lessonEntitlementSchema>;
export type EnrollmentStatus = z.infer<typeof enrollmentStatusSchema>;
export type AdminOverview = z.infer<typeof adminOverviewSchema>;
export type ModerationReview = z.infer<typeof moderationReviewSchema>;
export type CourseDraft = z.infer<typeof courseDraftSchema>;
export type LessonDraft = z.infer<typeof lessonDraftSchema>;
