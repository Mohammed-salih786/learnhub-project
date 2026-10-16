/**
 * Razorpay integration helpers.
 *
 * Key decisions:
 * - Subscriptions use Razorpay Subscriptions API (not one-time orders).
 * - UPI Intent/QR is enabled (UPI Collect Autopay is deprecated for new mandates).
 * - Signature verification uses HMAC-SHA256.
 * - Webhook handler is idempotent (checks payment_events for duplicates).
 * - Entitlement is ONLY granted after webhook confirmation — never after client-side
 *   payment success (which can be spoofed).
 */

import crypto from "crypto";

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
const RAZORPAY_BASE_URL = "https://api.razorpay.com/v1";

function razorpayAuth() {
  return "Basic " + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
}

// ---------------------------------------------------------------------------
// Subscription creation
// ---------------------------------------------------------------------------

interface CreateSubscriptionOptions {
  planId: string;        // Razorpay plan ID (e.g. "plan_xxxxx")
  totalCount?: number;   // billing cycles (12 for annual auto-renew; omit for monthly)
  customerEmail?: string;
  customerPhone?: string;
  notes?: Record<string, string>;
}

export async function createRazorpaySubscription(opts: CreateSubscriptionOptions): Promise<{
  id: string;
  status: string;
  shortUrl: string;
}> {
  const response = await fetch(`${RAZORPAY_BASE_URL}/subscriptions`, {
    method: "POST",
    headers: {
      "Authorization": razorpayAuth(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      plan_id: opts.planId,
      total_count: opts.totalCount ?? 120, // 10 years default; Razorpay requires a finite count
      quantity: 1,
      customer_notify: 1,
      notify_info: opts.customerEmail
        ? {
            notify_phone: opts.customerPhone,
            notify_email: opts.customerEmail
          }
        : undefined,
      notes: opts.notes
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Razorpay subscription creation failed: ${JSON.stringify(body)}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify Razorpay payment signature (for checkout completion).
 * orderId + "|" + paymentId signed with key_secret.
 */
export function verifyPaymentSignature(opts: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const message = `${opts.orderId}|${opts.paymentId}`;
  const expected = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(message)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(opts.signature));
}

/**
 * Verify Razorpay webhook signature.
 * Raw body signed with webhook_secret.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET) return true; // Local dev: skip verification
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ---------------------------------------------------------------------------
// Razorpay plan fetch
// ---------------------------------------------------------------------------

export async function getRazorpayPlan(planId: string): Promise<{
  id: string;
  item: { amount: number; currency: string; name: string };
  interval: number;
  period: string;
} | null> {
  const response = await fetch(`${RAZORPAY_BASE_URL}/plans/${planId}`, {
    headers: { "Authorization": razorpayAuth() }
  });
  if (!response.ok) return null;
  return response.json();
}

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = true
): Promise<{ id: string; status: string }> {
  const response = await fetch(
    `${RAZORPAY_BASE_URL}/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        "Authorization": razorpayAuth(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 })
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Razorpay subscription cancel failed: ${JSON.stringify(body)}`);
  }

  return response.json();
}
