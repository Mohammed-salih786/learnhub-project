import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";

function assertAdmin(request: NextRequest) {
  return request.cookies.get("learnhub_role")?.value === "admin";
}

const updatePlanSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(2).max(80).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  description: z.string().max(300).optional()
});

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const db = createServerSupabaseClient();
  const { data, error } = await db.from("plans").select("*").order("amount_cents", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plans: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updatePlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { id, ...updates } = parsed.data;
  const db = createServerSupabaseClient();
  const adminId = request.cookies.get("learnhub_session")?.value;

  const dbUpdates: Record<string, unknown> = {};
  if (updates.label !== undefined) dbUpdates.label = updates.label;
  if (updates.amountCents !== undefined) dbUpdates.amount_cents = updates.amountCents;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  const { data, error } = await db
    .from("plans")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // Audit log
  if (adminId) {
    await db.from("admin_audit_log").insert({
      actor_id: adminId,
      action: "update_plan",
      target_type: "plans",
      target_id: id,
      details: dbUpdates
    });
  }

  return NextResponse.json({ ok: true, plan: data });
}
