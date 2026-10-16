import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createBunnyVideoEntry } from "@/lib/video";
import { createServerSupabaseClient } from "@/lib/supabase";

const uploadRequestSchema = z.object({
  lessonId: z.string().uuid(),
  courseId: z.string().uuid(),
  title: z.string().min(2).max(120)
});

/**
 * POST /api/instructor/upload
 * Creates a Bunny Stream video entry and returns the TUS upload URL
 * for resumable direct-from-browser upload.
 *
 * The client uses the returned uploadUrl with a TUS client library (tus-js-client)
 * to upload the video file directly to Bunny — the file never passes through
 * our server, reducing bandwidth costs and latency.
 */
export async function POST(request: NextRequest) {
  const instructorId = request.cookies.get("learnhub_session")?.value;
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = uploadRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { lessonId, courseId, title } = parsed.data;

  // Verify instructor owns this course
  const db = createServerSupabaseClient();
  const { data: course } = await db
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .eq("instructor_id", instructorId)
    .single();

  if (!course) {
    return NextResponse.json({ ok: false, error: "Course not found or access denied." }, { status: 403 });
  }

  try {
    const { videoId, uploadUrl } = await createBunnyVideoEntry({ title, courseId, lessonId });

    // Store video ID on the lesson (status: processing until webhook confirms)
    await db
      .from("lessons")
      .update({
        video_url: videoId,
        // We store a custom metadata field to track Bunny's status
      })
      .eq("id", lessonId);

    return NextResponse.json({
      ok: true,
      videoId,
      uploadUrl,
      // Pass Bunny library ID and expiry header for TUS upload
      tusHeaders: {
        AuthorizationSignature: "", // Bunny TUS uses HMAC — sign client-side per their docs
        AuthorizationExpire: Math.floor(Date.now() / 1000) + 3600,
        VideoId: videoId,
        LibraryId: process.env.BUNNY_LIBRARY_ID ?? ""
      },
      message: "Upload slot created. Use the TUS client to upload the video."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create upload slot.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
