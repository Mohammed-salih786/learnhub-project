import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

function assertAdmin(request: NextRequest) {
  return request.cookies.get("learnhub_role")?.value === "admin";
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("moderation_flags")
    .select(`
      *,
      course:courses!course_id(id, title, slug, instructor_id,
        instructor:profiles!instructor_id(full_name, email)
      ),
      admin:profiles!admin_id(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, flags: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const schema = z.object({
    courseId: z.string().uuid(),
    reason: z.string().min(10).max(500),
    severity: z.enum(["low", "medium", "high"])
  });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const adminId = request.cookies.get("learnhub_session")?.value;
  const db = createServerSupabaseClient();

  const { data, error } = await db
    .from("moderation_flags")
    .insert({
      course_id: parsed.data.courseId,
      admin_id: adminId,
      status: "pending",
      reason: parsed.data.reason
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, flag: data }, { status: 201 });
}
