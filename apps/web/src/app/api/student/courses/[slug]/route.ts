import { NextRequest, NextResponse } from "next/server";

import { getCourseBySlug, getUserEntitlementContext } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const course = await getCourseBySlug(params.slug);

  if (!course) {
    return NextResponse.json({ ok: false, error: "Course not found." }, { status: 404 });
  }

  const userId = request.cookies.get("learnhub_session")?.value;
  const db = createServerSupabaseClient();

  // Fetch enrollment and progress if user is logged in
  let enrollmentData = null;
  let progressData: Record<string, number> = {};

  if (userId) {
    const [enrollRes, progressRes] = await Promise.all([
      db.from("enrollments").select("id, enrolled_at").eq("user_id", userId).eq("course_id", course.id).single(),
      db
        .from("lesson_progress")
        .select("lesson_id, percent_complete, completed")
        .eq("user_id", userId)
    ]);

    enrollmentData = enrollRes.data;
    progressData = Object.fromEntries(
      (progressRes.data ?? []).map((p) => [p.lesson_id, p.percent_complete ?? 0])
    );
  }

  // Compute per-lesson progress
  type LessonRow = { id: string; [key: string]: unknown };
  const modules = ((course as { modules?: unknown[] }).modules ?? []).map((mod) => {
    const m = mod as Record<string, unknown>;
    return {
      ...m,
      lessons: ((m.lessons as LessonRow[] | undefined) ?? []).map((lesson) => ({
        ...lesson,
        progress: progressData[lesson.id] ?? 0
      }))
    };
  });

  const allLessons = modules.flatMap((m) => (m.lessons as LessonRow[]) ?? []);
  const avgProgress =
    allLessons.length > 0
      ? Math.round(
          Object.values(progressData).reduce((sum, v) => sum + v, 0) / allLessons.length
        )
      : 0;

  return NextResponse.json({
    ok: true,
    course: { ...course, modules },
    enrolled: !!enrollmentData,
    progress: avgProgress,
    totalLessons: allLessons.length
  });
}
