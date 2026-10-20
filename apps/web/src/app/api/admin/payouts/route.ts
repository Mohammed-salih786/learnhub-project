import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { estimateInstructorEarnings } from "@learnhub/shared";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const db = createServerSupabaseClient();

  // Get total platform revenue
  const { data: payments } = await db
    .from("payments")
    .select("amount_cents")
    .eq("status", "captured");
  const totalRevenuePaise = (payments ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  // Get all instructors
  const { data: instructors } = await db
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .eq("role", "instructor");

  // Get total platform watch-minutes (using lesson_progress)
  const { data: allProgress } = await db.from("lesson_progress").select("percent_complete, lesson_id");
  const totalPlatformWatchMinutes = (allProgress ?? []).reduce((s, p) => s + (p.percent_complete ?? 0), 0);

  // Compute per-instructor earnings estimate
  const payoutEstimates = await Promise.all(
    (instructors ?? []).map(async (instructor) => {
      const { data: courses } = await db
        .from("courses")
        .select("id")
        .eq("instructor_id", instructor.id);

      const courseIds = (courses ?? []).map((c) => c.id);
      if (courseIds.length === 0) {
        return {
          instructorId: instructor.id,
          instructor,
          estimatedEarningsPaise: 0,
          earningsFormatted: "₹0",
          isEstimate: true
        };
      }

      const { data: lessons } = await db
        .from("lessons")
        .select("id")
        .in("course_id", courseIds);

      const lessonIds = (lessons ?? []).map((l) => l.id);
      const { data: instructorProgress } = await db
        .from("lesson_progress")
        .select("percent_complete")
        .in("lesson_id", lessonIds);

      const instructorWatchMinutes = (instructorProgress ?? []).reduce(
        (s, p) => s + (p.percent_complete ?? 0),
        0
      );

      const result = estimateInstructorEarnings({
        instructorWatchMinutes,
        totalPlatformWatchMinutes,
        totalRevenuePaise,
        instructorSharePercent: 0.7
      });

      return {
        instructorId: instructor.id,
        instructor,
        estimatedEarningsPaise: result.estimatedEarningsPaise,
        earningsFormatted: result.estimatedEarningsFormatted,
        watchMinuteContribution: result.watchMinuteContribution,
        isEstimate: true
      };
    })
  );

  const totalEstimatedPayoutPaise = payoutEstimates.reduce(
    (s, p) => s + p.estimatedEarningsPaise,
    0
  );

  return NextResponse.json({
    ok: true,
    payouts: payoutEstimates,
    totalRevenuePaise,
    totalEstimatedPayoutPaise,
    disclaimer:
      "All earnings are estimates. Actual payouts are processed manually. Download CSV for reconciliation.",
    generatedAt: new Date().toISOString()
  });
}
