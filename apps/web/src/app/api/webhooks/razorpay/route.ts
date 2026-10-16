/**
 * Razorpay Webhook Handler
 *
 * Security:
 * - Signature verified with HMAC-SHA256 before processing
 * - Idempotent: checks payment_events for duplicate event IDs
 * - Raw body is read before any JSON parsing (signature uses raw bytes)
 *
 * Events handled:
 * - subscription.authenticated → subscription created, awaiting first payment
 * - subscription.activated      → first payment received, grant access
 * - subscription.charged        → recurring charge success, extend access
 * - subscription.pending        → payment pending (UPI async)
 * - subscription.halted         → multiple payment failures, access revoked after grace
 * - subscription.cancelled      → user cancelled
 * - subscription.completed      → all billing cycles exhausted
 * - payment.failed              → single payment failed (grace period starts)
 */

import { NextRequest, NextResponse } from "next/server";

import { verifyWebhookSignature } from "@/lib/razorpay";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createNotification } from "@/lib/db";
import { sendPaymentFailedEmail, sendRenewalReminder } from "@/lib/messaging";

const GRACE_PERIOD_DAYS = 3;

export async function POST(request: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const eventType = event.event as string;
  const eventId = (event as { id?: string }).id ?? `${eventType}_${Date.now()}`;
  const db = createServerSupabaseClient();

  // 2. Idempotency check — skip if we've already processed this event
  const { data: existing } = await db
    .from("payment_events")
    .select("id")
    .eq("event_type", eventType)
    .contains("payload", { id: eventId })
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, skipped: true, reason: "duplicate" });
  }

  // 3. Extract subscription/payment from payload
  const payload = event.payload as Record<string, unknown> | undefined;
  const subscriptionEntity =
    (payload?.subscription as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  const paymentEntity =
    (payload?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;

  const razorpaySubId =
    subscriptionEntity?.id as string | undefined ??
    paymentEntity?.subscription_id as string | undefined;

  const notes = (subscriptionEntity?.notes as Record<string, string> | undefined) ?? {};
  const userId = notes.userId ?? null;

  // 4. Persist raw event for auditability/replay
  if (razorpaySubId) {
    const { data: localSub } = await db
      .from("subscriptions")
      .select("id")
      .eq("razorpay_subscription_id", razorpaySubId)
      .single();

    await db.from("payment_events").insert({
      payment_id: localSub?.id ?? null,
      source: "razorpay",
      event_type: eventType,
      payload: event as Record<string, unknown>
    });
  }

  // 5. Handle each event type
  switch (eventType) {
    case "subscription.authenticated": {
      // Subscription created in Razorpay, waiting for first payment
      // Status stays pending — no access granted yet
      break;
    }

    case "subscription.activated": {
      // First payment succeeded — activate subscription
      if (razorpaySubId) {
        const endDate = subscriptionEntity?.current_end
          ? new Date((subscriptionEntity.current_end as number) * 1000).toISOString()
          : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

        await db
          .from("subscriptions")
          .update({
            status: "active",
            ends_at: endDate
          })
          .eq("razorpay_subscription_id", razorpaySubId);

        if (userId) {
          await createNotification({
            userId,
            kind: "subscription_activated",
            message: "Your LearnHub subscription is now active. Enjoy full access!"
          });
        }
      }
      break;
    }

    case "subscription.charged": {
      // Recurring charge success — extend subscription
      if (razorpaySubId) {
        const endDate = subscriptionEntity?.current_end
          ? new Date((subscriptionEntity.current_end as number) * 1000).toISOString()
          : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

        await db
          .from("subscriptions")
          .update({
            status: "active",
            ends_at: endDate
          })
          .eq("razorpay_subscription_id", razorpaySubId);

        // Record payment
        if (userId && paymentEntity) {
          const { data: sub } = await db
            .from("subscriptions")
            .select("id, plan_id")
            .eq("razorpay_subscription_id", razorpaySubId)
            .single();

          if (sub) {
            await db.from("payments").insert({
              user_id: userId,
              plan_id: sub.plan_id,
              amount_cents: (paymentEntity.amount as number) ?? 0,
              currency: "INR",
              status: "captured",
              razorpay_payment_id: paymentEntity.id as string,
              razorpay_order_id: paymentEntity.order_id as string | undefined
            });
          }
        }
      }
      break;
    }

    case "subscription.pending": {
      // Payment pending (UPI async flow) — maintain current status, notify
      if (userId) {
        await createNotification({
          userId,
          kind: "payment_pending",
          message: "Your payment is being processed. Access will be restored once confirmed."
        });
      }
      break;
    }

    case "subscription.halted": {
      // Multiple failures — grace period starts, then access revoked
      if (razorpaySubId) {
        const graceEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

        await db
          .from("subscriptions")
          .update({
            status: "active", // Still active during grace period
            ends_at: graceEnd
          })
          .eq("razorpay_subscription_id", razorpaySubId);

        if (userId) {
          const { data: profile } = await db
            .from("profiles")
            .select("email, full_name")
            .eq("id", userId)
            .single();

          await createNotification({
            userId,
            kind: "payment_failed",
            message: `Your payment has failed. You have a ${GRACE_PERIOD_DAYS}-day grace period to update your payment method.`
          });

          if (profile?.email) {
            await sendPaymentFailedEmail(profile.email, profile.full_name ?? "learner").catch(
              (e) => console.error("Failed to send payment failed email:", e)
            );
          }
        }
      }
      break;
    }

    case "subscription.cancelled": {
      if (razorpaySubId) {
        const endsAt = subscriptionEntity?.current_end
          ? new Date((subscriptionEntity.current_end as number) * 1000).toISOString()
          : null;

        await db
          .from("subscriptions")
          .update({
            status: "cancelled",
            ends_at: endsAt // Access continues until period end
          })
          .eq("razorpay_subscription_id", razorpaySubId);

        if (userId) {
          await createNotification({
            userId,
            kind: "subscription_cancelled",
            message: "Your subscription has been cancelled. You can continue learning until the end of your current period."
          });
        }
      }
      break;
    }

    case "subscription.completed": {
      if (razorpaySubId) {
        await db
          .from("subscriptions")
          .update({ status: "expired" })
          .eq("razorpay_subscription_id", razorpaySubId);
      }
      break;
    }

    case "payment.failed": {
      if (userId) {
        await createNotification({
          userId,
          kind: "payment_failed",
          message: "A payment attempt failed. Please check your payment method."
        });
      }
      break;
    }

    default:
      // Log unknown events but return 200 so Razorpay doesn't retry
      console.info(`[Razorpay webhook] Unhandled event type: ${eventType}`);
  }

  return NextResponse.json({ ok: true, event: eventType });
}
