import { describe, expect, it } from "vitest";

import { canAccessCourse, canAccessLesson } from "./entitlements";

describe("entitlement logic", () => {
  it("allows preview lessons", () => {
    expect(
      canAccessLesson({
        isPreview: true,
        isPaidLesson: true,
        hasActiveSubscription: false,
        hasActiveTrial: false,
        freeCoursesConsumed: 0,
        freeCourseLimit: 2
      })
    ).toBe(true);
  });

  it("allows paid access for active subscribers", () => {
    expect(
      canAccessLesson({
        isPreview: false,
        isPaidLesson: true,
        hasActiveSubscription: true,
        hasActiveTrial: false,
        freeCoursesConsumed: 0,
        freeCourseLimit: 2
      })
    ).toBe(true);
  });

  it("allows trial access until free course limit is exhausted", () => {
    expect(
      canAccessLesson({
        isPreview: false,
        isPaidLesson: true,
        hasActiveSubscription: false,
        hasActiveTrial: true,
        freeCoursesConsumed: 1,
        freeCourseLimit: 2
      })
    ).toBe(true);

    expect(
      canAccessLesson({
        isPreview: false,
        isPaidLesson: true,
        hasActiveSubscription: false,
        hasActiveTrial: true,
        freeCoursesConsumed: 2,
        freeCourseLimit: 2
      })
    ).toBe(false);
  });

  it("prevents non-subscribers from accessing paid courses", () => {
    expect(
      canAccessCourse({
        hasActiveSubscription: false,
        hasActiveTrial: false,
        completedCourses: 0,
        freeCourseLimit: 2
      })
    ).toBe(false);
  });
});
