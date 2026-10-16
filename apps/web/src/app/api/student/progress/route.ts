import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { upsertLessonProgress } from "@/lib/db";

const heartbeatSchema = z.object({
  lessonId: z.string().uuid(),
  positionSeconds: z.number().int().nonnegative(),
  durationSeconds: z.number().int().positive()
});

/**
 * POST /api/student/progress
 * Progress heartbeat — called every ~10 seconds during video playback.
 * Updates lesson_progress with current position and computed completion percent.
 */
export async function POST(request: NextRequest) {
  const userId = request.cookies.get("learnhub_session")?.value;
  const isLocalDev = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost");

  if (!userId && !isLocalDev) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = heartbeatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  if (isLocalDev && !userId) {
    // Dev mode — just acknowledge
    return NextResponse.json({ ok: true, dev: true });
  }

  const { lessonId, positionSeconds, durationSeconds } = parsed.data;
  const percentComplete = Math.min(100, Math.round((positionSeconds / durationSeconds) * 100));

  try {
    await upsertLessonProgress({
      userId: userId!,
      lessonId,
      percentComplete,
      lastPositionSeconds: positionSeconds,
      completed: percentComplete >= 90
    });

    return NextResponse.json({ ok: true, percentComplete });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save progress.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
