import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { estimateInstructorEarnings } from "@learnhub/shared";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const instructorId = request.cookies.get("learnhub_session")?.value;
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const db = createServerSupabaseClient();

  const { data: course, error } = await db
    .from("courses")
    .select(`
      *,
      modules(id, title, sort_order,
        lessons(id, title, sort_order, duration_seconds, preview)
      ),
      tests(id, title, total_marks)
    `)
    .eq("id", params.id)
    .eq("instructor_id", instructorId)
    .single();

  if (error || !course) {
    return NextResponse.json({ ok: false, error: "Course not found." }, { status: 404 });
  }

  // Enrolled students with progress
  const { data: enrollments } = await db
    .from("enrollments")
    .select(`
      user_id,
      enrolled_at,
      user:profiles!user_id(id, full_name, avatar_url),
      progress:lesson_progress(percent_complete)
    `)
    .eq("course_id", params.id)
    .limit(50);

  // Lesson completion rates
  const { data: lessons } = await db
    .from("lessons")
    .select("id, title")
    .eq("course_id", params.id);

  const lessonStatusList = await Promise.all(
    (lessons ?? []).map(async (lesson) => {
      const { count: total } = await db
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("course_id", params.id);

      const { count: completed } = await db
        .from("lesson_progress")
        .select("id", { count: "exact", head: true })
        .eq("lesson_id", lesson.id)
        .eq("completed", true);

      return {
        id: lesson.id,
        title: lesson.title,
        completionRate: total && total > 0 ? Math.round(((completed ?? 0) / total) * 100) : 0
      };
    })
  );

  // Instructor earnings estimate
  const { data: instructorWatch } = await db
    .from("lesson_progress")
    .select("percent_complete")
    .in("lesson_id", (lessons ?? []).map((l) => l.id));

  const { data: platformWatch } = await db
    .from("lesson_progress")
    .select("percent_complete");

  const instructorWatchMinutes = (instructorWatch ?? []).reduce(
    (sum, p) => sum + (p.percent_complete ?? 0),
    0
  );
  const totalPlatformWatchMinutes = (platformWatch ?? []).reduce(
    (sum, p) => sum + (p.percent_complete ?? 0),
    0
  );

  const { data: payments } = await db
    .from("payments")
    .select("amount_cents")
    .eq("status", "captured");
  const totalRevenuePaise = (payments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  const earningsEstimate = estimateInstructorEarnings({
    instructorWatchMinutes,
    totalPlatformWatchMinutes,
    totalRevenuePaise,
    instructorSharePercent: 0.7
  });

  const learners = (enrollments ?? []).map((e: Record<string, unknown>) => {
    const progress = (e.progress as Array<{ percent_complete: number }> | undefined) ?? [];
    const avg =
      progress.length > 0
        ? Math.round(progress.reduce((s, p) => s + (p.percent_complete ?? 0), 0) / progress.length)
        : 0;
    return {
      userId: e.user_id,
      user: e.user,
      enrolledAt: e.enrolled_at,
      completionPercent: avg
    };
  });

  return NextResponse.json({
    ok: true,
    course,
    learners,
    lessonStatus: lessonStatusList,
    earningsEstimate
  });
}
