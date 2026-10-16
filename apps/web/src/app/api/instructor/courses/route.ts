import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { courseDraftSchema } from "@learnhub/shared";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getCoursesByInstructor } from "@/lib/db";

function getInstructorId(request: NextRequest): string | null {
  // In production, this comes from the verified Supabase JWT session.
  // For local dev, fall back to cookie.
  return request.cookies.get("learnhub_session")?.value ?? null;
}

export async function GET(request: NextRequest) {
  const instructorId = getInstructorId(request);
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  try {
    const courses = await getCoursesByInstructor(instructorId);
    return NextResponse.json({ ok: true, data: courses, total: courses.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load courses.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const instructorId = getInstructorId(request);
  if (!instructorId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = courseDraftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const db = createServerSupabaseClient();

  // Look up the category by name
  let categoryId: string | null = null;
  if (parsed.data.category) {
    const { data: cat } = await db
      .from("categories")
      .select("id")
      .ilike("name", parsed.data.category)
      .single();
    categoryId = cat?.id ?? null;
  }

  const slug = parsed.data.slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const { data: course, error } = await db
    .from("courses")
    .insert({
      instructor_id: instructorId,
      category_id: categoryId,
      title: parsed.data.title,
      slug,
      short_description: parsed.data.shortDescription,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents ?? 0,
      status: "draft"
    })
    .select()
    .single();

  if (error) {
    // Slug conflict
    if (error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "A course with this slug already exists. Choose a different title." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, course, message: "Course draft created." }, { status: 201 });
}
