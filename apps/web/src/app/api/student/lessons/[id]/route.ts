import { NextRequest, NextResponse } from "next/server";

import { canAccessLesson } from "@learnhub/shared";
import { getLessonById, getUserEntitlementContext } from "@/lib/db";
import { generateSignedPlaybackUrl } from "@/lib/video";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lesson = await getLessonById(params.id);

  if (!lesson) {
    return NextResponse.json({ ok: false, error: "Lesson not found." }, { status: 404 });
  }

  // In local dev (no real userId), grant access to preview lessons only
  const userId = request.cookies.get("learnhub_session")?.value;
  const isLocalDev = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost");

  let entitlementCtx: {
    isPreview: boolean;
    isPaidLesson: boolean;
    hasActiveSubscription: boolean;
    hasActiveTrial: boolean;
    freeCoursesConsumed: number;
    freeCourseLimit: number;
    userRole: "student" | "instructor" | "admin";
  } = {
    isPreview: !!lesson.preview,
    isPaidLesson: !!lesson.is_paid,
    hasActiveSubscription: false,
    hasActiveTrial: false,
    freeCoursesConsumed: 0,
    freeCourseLimit: 2,
    userRole: "student"
  };

  if (userId && !isLocalDev) {
    const ctx = await getUserEntitlementContext(userId);
    if (ctx) {
      entitlementCtx = {
        isPreview: !!lesson.preview,
        isPaidLesson: !!lesson.is_paid,
        hasActiveSubscription: ctx.hasActiveSubscription,
        hasActiveTrial: ctx.hasActiveTrial,
        freeCoursesConsumed: ctx.freeCoursesConsumed,
        freeCourseLimit: ctx.freeCourseLimit,
        userRole: ctx.role as "student" | "instructor" | "admin"
      };
    }
  } else if (isLocalDev) {
    // Local dev: grant full access for testing
    entitlementCtx.hasActiveSubscription = true;
  }

  const access = canAccessLesson(entitlementCtx);

  if (!access) {
    return NextResponse.json(
      { ok: false, error: "Subscribe to access this lesson.", requiresSubscription: true },
      { status: 403 }
    );
  }

  // Issue a short-lived signed playback URL (server-side only)
  const playbackUrl = await generateSignedPlaybackUrl(lesson.video_url ?? "", {
    userId: userId ?? "anonymous",
    lessonId: lesson.id,
    courseId: (lesson.course as { id: string } | null)?.id ?? ""
  });

  return NextResponse.json({
    ok: true,
    lesson: {
      id: lesson.id,
      title: lesson.title,
      summary: lesson.summary,
      durationSeconds: lesson.duration_seconds,
      preview: lesson.preview,
      resources: lesson.resources ?? []
    },
    playbackUrl,
    accessGranted: true
  });
}
