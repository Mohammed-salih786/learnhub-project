import { NextRequest, NextResponse } from "next/server";

import { getAdminOverviewStats } from "@/lib/db";
import { createServerSupabaseClient } from "@/lib/supabase";

function assertAdmin(request: NextRequest) {
  const role = request.cookies.get("learnhub_role")?.value;
  return role === "admin";
}

export async function GET(request: NextRequest) {
  if (!assertAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  try {
    const db = createServerSupabaseClient();

    const [stats, popularCourses, recentSignups] = await Promise.all([
      getAdminOverviewStats(),
      db
        .from("courses")
        .select(`
          id, title, slug, status, published_at,
          enrollments(count),
          reviews(rating)
        `)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(5),
      db
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    // Compute MRR/ARR
    const db2 = createServerSupabaseClient();
    const { data: subs } = await db2
      .from("subscriptions")
      .select("plan:plans!plan_id(key, amount_cents)")
      .eq("status", "active");

    let mrrPaise = 0;
    let arrPaise = 0;
    for (const sub of subs ?? []) {
      // Supabase returns FK joins as array; take first element
      const rawPlan = (sub as Record<string, unknown>).plan;
      const plan = Array.isArray(rawPlan)
        ? (rawPlan[0] as { key: string; amount_cents: number } | undefined)
        : (rawPlan as { key: string; amount_cents: number } | null | undefined);
      if (!plan) continue;
      if (plan.key === "monthly") mrrPaise += plan.amount_cents;
      if (plan.key === "yearly") arrPaise += plan.amount_cents;
    }
    // MRR from yearly = amount / 12
    mrrPaise += Math.round(arrPaise / 12);

    return NextResponse.json({
      ok: true,
      stats: {
        ...stats,
        mrrPaise,
        arrPaise
      },
      popularCourses: popularCourses.data ?? [],
      recentSignups: recentSignups.data ?? [],
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overview.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
