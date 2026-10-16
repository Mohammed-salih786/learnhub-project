import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSwachhUser } from "@/lib/auth";
import { createDatabaseClient } from "@/lib/supabase";

const actionSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string } },
) {
  let user;
  try {
    user = await getSwachhUser(request);
  } catch (error) {
    console.error("Failed to authenticate municipal user:", error);
    return NextResponse.json(
      { ok: false, error: "Authentication service is unavailable." },
      { status: 503 },
    );
  }
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  if (
    !user.role ||
    !["city_commissioner", "waste_manager", "supervisor"].includes(user.role)
  ) {
    return NextResponse.json(
      { ok: false, error: "Your municipal role cannot update actions." },
      { status: 403 },
    );
  }

  const actionId = z.string().uuid().safeParse(context.params.id);
  if (!actionId.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid preventive action ID." },
      { status: 400 },
    );
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      },
      { status: 400 },
    );
  }

  try {
    const db = createDatabaseClient();
    const { data, error } = await db
      .from("swachh_preventive_actions")
      .update({ status: parsed.data.status })
      .eq("id", actionId.data)
      .select("id, action_type, status, scheduled_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, action: data });
  } catch (error) {
    console.error("Failed to update preventive action:", error);
    return NextResponse.json(
      { ok: false, error: "Could not update the preventive action." },
      { status: 500 },
    );
  }
}
