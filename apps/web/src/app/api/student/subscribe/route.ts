import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createRazorpaySubscription } from "@/lib/razorpay";
import { createServerSupabaseClient } from "@/lib/supabase";

const subscribeSchema = z.object({
  planKey: z.enum(["monthly", "yearly"])
});

/**
 * POST /api/student/subscribe
 * Creates a Razorpay subscription and returns the subscription ID + Razorpay key
 * for client-side Razorpay checkout initialization.
 *
 * Entitlement is NOT granted here — only after the webhook confirms payment.
 */
export async function POST(request: NextRequest) {
  const userId = request.cookies.get("learnhub_session")?.value;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const db = createServerSupabaseClient();

  // Get the plan
  const planEnvKey =
    parsed.data.planKey === "monthly"
      ? process.env.RAZORPAY_MONTHLY_PLAN_ID
      : process.env.RAZORPAY_YEARLY_PLAN_ID;

  if (!planEnvKey) {
    return NextResponse.json(
      { ok: false, error: "Subscription plans are not configured yet. Please contact support." },
      { status: 503 }
    );
  }

  // Get user profile for prefill
  const { data: profile } = await db
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", userId)
    .single();

  // Local dev: skip Razorpay API call
  const isLocalDev = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.startsWith("rzp_test_xxx");

  if (isLocalDev) {
    return NextResponse.json({
      ok: true,
      subscriptionId: `sub_dev_${Date.now()}`,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "rzp_test_demo",
      prefill: { name: profile?.full_name, email: profile?.email, contact: profile?.phone },
      isDev: true
    });
  }

  try {
    const subscription = await createRazorpaySubscription({
      planId: planEnvKey,
      totalCount: parsed.data.planKey === "yearly" ? 36 : 120, // 3 years or 10 years
      customerEmail: profile?.email ?? undefined,
      customerPhone: profile?.phone ?? undefined,
      notes: { userId, planKey: parsed.data.planKey }
    });

    // Store pending subscription record (status will be updated by webhook)
    const { data: plan } = await db.from("plans").select("id").eq("key", parsed.data.planKey).single();

    if (plan) {
      await db.from("subscriptions").insert({
        user_id: userId,
        plan_id: plan.id,
        status: "trial", // Placeholder until webhook confirms
        razorpay_subscription_id: subscription.id,
        starts_at: new Date().toISOString()
      });
    }

    return NextResponse.json({
      ok: true,
      subscriptionId: subscription.id,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
      prefill: { name: profile?.full_name, email: profile?.email, contact: profile?.phone }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create subscription.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
