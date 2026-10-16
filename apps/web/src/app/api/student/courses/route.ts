import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getPublishedCourses } from "@/lib/db";

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("learnhub_session")?.value;
  const db = createServerSupabaseClient();

  try {
    const [catalogResult, enrollmentsResult] = await Promise.all([
      getPublishedCourses({ limit: 24 }),
      userId
        ? db
            .from("enrollments")
            .select(`
              course_id,
              enrolled_at,
              course:courses!course_id(id, title, slug, thumbnail_url),
              progress:lesson_progress(percent_complete, completed, lesson_id)
            `)
            .eq("user_id", userId)
        : Promise.resolve({ data: [], error: null })
    ]);

    const enrollments = (enrollmentsResult.data ?? []).map((e: Record<string, unknown>) => {
      const progressItems = (e.progress as Array<{ percent_complete: number; completed: boolean }> | undefined) ?? [];
      const completionPercent = progressItems.length > 0
        ? Math.round(
            progressItems.reduce((sum, p) => sum + (p.percent_complete ?? 0), 0) / progressItems.length
          )
        : 0;
      return { ...e, completionPercent };
    });

    return NextResponse.json({
      ok: true,
      enrollments,
      catalog: catalogResult,
      total: catalogResult.length
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load courses.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
