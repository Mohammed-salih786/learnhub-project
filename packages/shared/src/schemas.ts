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

export const accountRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(1024),
  role: z.enum(["student", "instructor"]).default("student"),
  bio: z.string().trim().max(1000).optional(),
  headline: z.string().trim().max(120).optional(),
  sampleLink: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value)).optional()
}).strict();

export const instructorRequestSchema = z.object({
  bio: z.string().trim().min(10).max(1000),
  headline: z.string().trim().min(3).max(120),
  sampleLink: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value)).optional()
}).strict();

export const roleTransitionSchema = z.object({ role: z.literal("student") }).strict();

export const instructorCourseCreateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  category: z.string().trim().min(2).max(60).optional(),
  category_id: z.string().min(1).max(100).optional(),
  shortDescription: z.string().trim().max(220).optional(),
  description: z.string().trim().max(2000).optional(),
  priceCents: z.number().int().min(0).max(1000000000).optional(),
  thumbnailUrl: z.string().url().max(2048).optional()
}).strict();

export const instructorCourseUpdateSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  description: z.string().trim().max(2000).optional(),
  short_description: z.string().trim().max(220).optional(),
  thumbnail_url: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value)).optional(),
  price_cents: z.number().int().min(0).max(1000000000).optional(),
  status: z.enum(["draft", "pending_review"]).optional(),
  category_id: z.string().min(1).max(100).optional()
}).strict();

export const courseApprovalFilterSchema = z.enum([
  "draft",
  "pending_review",
  "published",
  "rejected",
  "unpublished",
  "archived"
]);

export const courseRejectionSchema = z.object({
  reason: z.string().trim().min(10).max(1000)
}).strict();

export const adminUserStatusSchema = z.enum(["active", "suspended", "deleted"]);

export const adminCategoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional()
}).strict();

export const adminCategoryUpdateSchema = adminCategoryCreateSchema.partial().strict();

export const instructorApplicationRejectionSchema = courseRejectionSchema;

export const instructorVerificationSchema = z.object({
  verified_badge: z.boolean()
}).strict();

export const paymentSubscribeSchema = z.object({
  planKey: z.enum(["monthly", "yearly"])
}).strict();

export const paymentVerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().length(64).regex(/^[a-f0-9]+$/i)
}).strict();

export const payoutMarkPaidSchema = z.object({
  reference: z.string().trim().min(1).max(120)
}).strict();

export const adminUserStatusUpdateSchema = z.object({
  reason: z.string().max(500).optional()
}).strict();

export const moderationResolutionSchema = z.object({
  status: z.enum(["resolved", "dismissed"]).default("resolved"),
  unpublishCourse: z.boolean().optional()
}).strict();

export const lessonCreateSchema = z.object({
  courseId: z.string().min(1).max(100).optional(),
  course_id: z.string().min(1).max(100).optional(),
  moduleId: z.string().min(1).max(100).optional(),
  module_id: z.string().min(1).max(100).optional(),
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().max(5000).optional(),
  content: z.string().max(50000).optional(),
  videoUrl: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value)).optional(),
  video_url: z.string().url().max(2048).refine((value) => /^https?:\/\//i.test(value)).optional(),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  duration_seconds: z.number().int().min(0).max(86400).optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
  preview: z.boolean().optional(),
  isPreview: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  is_paid: z.boolean().optional()
}).strict().superRefine((value, context) => {
  if (!value.courseId && !value.course_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["courseId"], message: "courseId is required." });
  }
  const aliases = [
    ["courseId", "course_id"],
    ["moduleId", "module_id"],
    ["videoUrl", "video_url"],
    ["durationSeconds", "duration_seconds"],
    ["sortOrder", "sort_order"],
    ["preview", "isPreview"],
    ["isPaid", "is_paid"]
  ] as const;
  for (const [first, second] of aliases) {
    if (value[first] !== undefined && value[second] !== undefined && value[first] !== value[second]) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [first], message: `Provide only one matching ${first} value.` });
    }
  }
});

export const lessonResourceSchema = z.object({
  title: z.string().trim().min(1).max(120),
  resourceType: z.enum(["link", "file"]),
  url: z.string().min(1).max(2048).refine((value) => {
    if (/^https?:\/\//i.test(value)) {
      try {
        return Boolean(new URL(value).hostname);
      } catch {
        return false;
      }
    }
    return value.startsWith("/uploads/") && !value.startsWith("//");
  }),
  description: z.string().max(1000).optional()
}).strict();

export const planWriteSchema = z.object({
  key: planKeySchema,
  label: z.string().trim().min(2).max(80).optional(),
  amount_cents: z.number().int().min(0).max(1000000000).optional(),
  currency: z.literal("INR").optional(),
  is_active: z.boolean().optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
  description: z.string().max(500).optional()
}).strict();

export const moderationFlagSchema = z.object({
  targetType: z.enum(["course", "lesson", "user"]),
  targetId: z.string().min(1).max(100),
  reason: z.string().trim().min(10).max(1000),
  severity: z.enum(["low", "medium", "high"]).default("medium")
}).strict();

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
  status: z.enum(["draft", "pending_review"]).default("draft")
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
