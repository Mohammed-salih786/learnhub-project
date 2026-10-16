import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSessionFromRequest } from "@/lib/session";
import { createServerSupabaseClient } from "@/lib/supabase";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(25).optional().default(""),
  bio: z.string().trim().max(1000).optional().default(""),
  headline: z.string().trim().max(120).optional().default("")
});

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in to view your profile." }, { status: 401 });

  const db = createServerSupabaseClient();
  const { data: profile, error } = await db.from("profiles").select("id, full_name, email, phone, role, avatar_url").eq("id", session.userId).single();
  if (error || !profile) {
    return NextResponse.json({
      ok: true,
      profile: { full_name: null, email: null, phone: null, avatar_url: null },
      instructorProfile: null
    });
  }

  let instructorProfile = null;
  if (session.role === "instructor") {
    const result = await db.from("instructor_profiles").select("bio, headline, verified_badge").eq("user_id", session.userId).maybeSingle();
    instructorProfile = result.data;
  }

  return NextResponse.json({ ok: true, profile, instructorProfile });
}

export async function PATCH(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in to update your profile." }, { status: 401 });

  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check your profile details." }, { status: 400 });

  const db = createServerSupabaseClient();
  const { fullName, phone, bio, headline } = parsed.data;
  const { error } = await db.from("profiles").upsert({
    id: session.userId,
    full_name: fullName,
    phone: phone || null,
    role: session.role
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ ok: false, error: "Could not save your profile." }, { status: 500 });

  if (session.role === "instructor") {
    const { error: instructorError } = await db.from("instructor_profiles").upsert({ user_id: session.userId, bio: bio || null, headline: headline || null }, { onConflict: "user_id" });
    if (instructorError) return NextResponse.json({ ok: false, error: "Your basic details were saved, but instructor details could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Profile updated." });
}
