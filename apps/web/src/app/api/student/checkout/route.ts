import { NextRequest, NextResponse } from "next/server";

import { getActivePlans, getUserEntitlementContext } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const [plans, entitlement] = await Promise.all([
      getActivePlans(),
      (async () => {
        const userId = request.cookies.get("learnhub_session")?.value;
        return userId ? getUserEntitlementContext(userId) : null;
      })()
    ]);

    const trialAvailable = !entitlement || (!entitlement.hasActiveSubscription && !entitlement.hasActiveTrial);

    return NextResponse.json({
      ok: true,
      plans,
      trialAvailable,
      currentPlan: entitlement?.planKey ?? null,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? ""
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load plans.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
