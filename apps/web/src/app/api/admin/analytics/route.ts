import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const db = createServerSupabaseClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [
    monthlyRevenue,
    lastMonthRevenue,
    trialCount,
    activeSubCount,
    cancelledCount,
    completionRates
  ] = await Promise.all([
    db.from("payments").select("amount_cents").eq("status", "captured").gte("created_at", startOfMonth),
    db.from("payments").select("amount_cents").eq("status", "captured").gte("created_at", startOfLastMonth).lt("created_at", startOfMonth),
    db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "trial"),
    db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
    db.from("lesson_progress").select("percent_complete")
  ]);

  const thisMonthPaise = (monthlyRevenue.data ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const lastMonthPaise = (lastMonthRevenue.data ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const growth = lastMonthPaise > 0 ? ((thisMonthPaise - lastMonthPaise) / lastMonthPaise) * 100 : 0;

  const completionValues = (completionRates.data ?? []).map((r) => r.percent_complete ?? 0);
  const avgCompletion = completionValues.length > 0
    ? Math.round(completionValues.reduce((s, v) => s + v, 0) / completionValues.length)
    : 0;

  const total = (trialCount.count ?? 0) + (activeSubCount.count ?? 0) + (cancelledCount.count ?? 0);
  const churnRate = total > 0 ? ((cancelledCount.count ?? 0) / total) * 100 : 0;
  const conversionRate =
    (trialCount.count ?? 0) + (activeSubCount.count ?? 0) > 0
      ? ((activeSubCount.count ?? 0) /
          ((trialCount.count ?? 0) + (activeSubCount.count ?? 0))) *
        100
      : 0;

  return NextResponse.json({
    ok: true,
    analytics: {
      thisMonthRevenuePaise: thisMonthPaise,
      lastMonthRevenuePaise: lastMonthPaise,
      revenueGrowthPercent: Math.round(growth * 10) / 10,
      trialUsers: trialCount.count ?? 0,
      activeSubscribers: activeSubCount.count ?? 0,
      cancelledCount: cancelledCount.count ?? 0,
      conversionRate: Math.round(conversionRate * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      avgCourseCompletionPercent: avgCompletion
    },
    lastUpdated: new Date().toISOString()
  });
}
