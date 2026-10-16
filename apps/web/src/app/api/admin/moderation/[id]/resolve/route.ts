import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

function assertAdmin(request: NextRequest) {
  return request.cookies.get("learnhub_role")?.value === "admin";
}

const resolveSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(500).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = resolveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { action } = parsed.data;
  const adminId = request.cookies.get("learnhub_session")?.value;
  const db = createServerSupabaseClient();

  const { data: flag, error: flagError } = await db
    .from("moderation_flags")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      admin_id: adminId
    })
    .eq("id", params.id)
    .select("*, course:courses!course_id(id, status)")
    .single();

  if (flagError || !flag) {
    return NextResponse.json({ ok: false, error: "Flag not found." }, { status: 404 });
  }

  // If rejected, archive the course
  const course = flag.course as { id: string; status: string } | null;
  if (action === "reject" && course) {
    await db
      .from("courses")
      .update({ status: "archived" })
      .eq("id", course.id);
  }

  // If approved and course is in review, publish it
  if (action === "approve" && course && course.status === "draft") {
    await db
      .from("courses")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", course.id);
  }

  // Log admin action
  if (adminId) {
    await db.from("admin_audit_log").insert({
      actor_id: adminId,
      action: `moderation_${action}`,
      target_type: "moderation_flags",
      target_id: params.id,
      details: { notes: parsed.data.notes ?? null, courseId: course?.id }
    });
  }

  return NextResponse.json({
    ok: true,
    flag,
    message: `Course ${action === "approve" ? "approved" : "rejected"} successfully.`
  });
}
