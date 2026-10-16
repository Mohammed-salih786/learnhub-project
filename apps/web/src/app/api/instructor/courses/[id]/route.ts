import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

function getInstructorId(request: NextRequest): string | null {
  return request.cookies.get("learnhub_session")?.value ?? null;
}

const updateCourseSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  shortDescription: z.string().min(20).max(220).optional(),
  description: z.string().min(50).max(2000).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  thumbnailUrl: z.string().url().optional(),
  categoryId: z.string().uuid().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const instructorId = getInstructorId(request);
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const db = createServerSupabaseClient();
  const { data: course, error } = await db
    .from("courses")
    .select(`
      *,
      modules(id, title, sort_order,
        lessons(id, title, summary, preview, is_paid, duration_seconds, sort_order, video_url,
          resources:lesson_resources(id, name, file_url, resource_type)
        )
      ),
      tests(id, title, total_marks,
        questions(id, question_type, prompt, options, marks, explanation)
      ),
      enrollments(count),
      reviews(rating)
    `)
    .eq("id", params.id)
    .eq("instructor_id", instructorId)
    .single();

  if (error || !course) {
    return NextResponse.json({ ok: false, error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, course });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const instructorId = getInstructorId(request);
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateCourseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const db = createServerSupabaseClient();

  // Verify ownership before update
  const { data: existing } = await db
    .from("courses")
    .select("id")
    .eq("id", params.id)
    .eq("instructor_id", instructorId)
    .single();

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Course not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title) updates.title = parsed.data.title;
  if (parsed.data.shortDescription) updates.short_description = parsed.data.shortDescription;
  if (parsed.data.description) updates.description = parsed.data.description;
  if (parsed.data.priceCents !== undefined) updates.price_cents = parsed.data.priceCents;
  if (parsed.data.status) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "published") {
      updates.published_at = new Date().toISOString();
    }
  }
  if (parsed.data.thumbnailUrl) updates.thumbnail_url = parsed.data.thumbnailUrl;
  if (parsed.data.categoryId) updates.category_id = parsed.data.categoryId;

  const { data: updated, error } = await db
    .from("courses")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, course: updated, message: "Course updated." });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const instructorId = getInstructorId(request);
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const db = createServerSupabaseClient();

  const { error } = await db
    .from("courses")
    .update({ status: "archived" }) // Soft delete — archive instead of hard delete
    .eq("id", params.id)
    .eq("instructor_id", instructorId);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Course archived." });
}
