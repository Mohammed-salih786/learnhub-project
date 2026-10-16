import { z } from "zod";

import { lessonEntitlementSchema } from "./schemas";

export function canAccessLesson(payload: unknown): boolean {
  const parsed = lessonEntitlementSchema.safeParse(payload);
  if (!parsed.success) {
    return false;
  }

  const { isPreview, isPaidLesson, hasActiveSubscription, hasActiveTrial, freeCoursesConsumed, freeCourseLimit } = parsed.data;

  if (isPreview) {
    return true;
  }

  if (!isPaidLesson) {
    return true;
  }

  if (hasActiveSubscription) {
    return true;
  }

  if (hasActiveTrial) {
    return freeCoursesConsumed < freeCourseLimit;
  }

  return false;
}

export function canAccessCourse(payload: unknown): boolean {
  const parsed = z
    .object({
      hasActiveSubscription: z.boolean().default(false),
      hasActiveTrial: z.boolean().default(false),
      completedCourses: z.number().int().nonnegative().default(0),
      freeCourseLimit: z.number().int().nonnegative().default(2)
    })
    .safeParse(payload);

  if (!parsed.success) {
    return false;
  }

  const { hasActiveSubscription, hasActiveTrial, completedCourses, freeCourseLimit } = parsed.data;

  if (hasActiveSubscription) {
    return true;
  }

  return hasActiveTrial && completedCourses < freeCourseLimit;
}

export function getAvailableTrialCourses(remainingFreeCourses: number): number {
  return Math.max(0, remainingFreeCourses);
}
