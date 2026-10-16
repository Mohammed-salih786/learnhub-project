import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getPublishedCourses } from "@/lib/db";

const querySchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(60).optional(),
  sort: z.enum(["trending", "newest", "top_rated", "most_enrolled"]).optional()
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  try {
    const courses = await getPublishedCourses({
      search: parsed.data.q,
      category: parsed.data.category,
      sort: parsed.data.sort
    });

    return NextResponse.json({ ok: true, courses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load courses.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
