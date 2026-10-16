import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const userId = request.cookies.get("learnhub_session")?.value;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("notifications")
    .select("id, kind, message, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    notifications: data ?? [],
    unreadCount: (data ?? []).filter((n) => !n.read_at).length
  });
}

export async function PATCH(request: NextRequest) {
  const userId = request.cookies.get("learnhub_session")?.value;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const schema = z.object({
    ids: z.array(z.string().uuid()).optional(),
    markAllRead: z.boolean().optional()
  });

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const db = createServerSupabaseClient();

  if (parsed.data.markAllRead) {
    await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
  } else if (parsed.data.ids?.length) {
    await db
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", parsed.data.ids);
  }

  return NextResponse.json({ ok: true });
}
