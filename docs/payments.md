# Payments — LearnHub

## Overview

Payments use **Razorpay Subscriptions** with UPI Intent/QR and card support.

> UPI Collect (NACH) is deprecated for new UPI Autopay mandates as of 2024.  
> We use **UPI Intent/QR** (`method: "upi"` in Razorpay checkout) which works without NACH registration.

## Plans

| Plan | Price | Razorpay billing | Features |
|---|---|---|---|
| Trial | ₹0 | Not billed | 7 days, 2 free courses, limited test attempts |
| Monthly | ₹149/mo | Monthly subscription | Full library access |
| Yearly | ₹999/yr | Annual subscription | Full library + certificates + priority support |

Prices are GST-inclusive. Plans are editable by admins without deploy via `PATCH /api/admin/plans`.

## Subscription Flow

```
Student clicks Subscribe
  → POST /api/student/subscribe (creates Razorpay subscription, returns sub ID)
  → Client opens Razorpay checkout with subscriptionId
  → Student completes payment (UPI/card)
  → Razorpay fires webhook: subscription.activated
  → POST /api/webhooks/razorpay (verified, idempotent)
  → subscriptions.status = 'active', ends_at set
  → In-app notification sent
  → Access unlocked
```

**Entitlement is NEVER granted on client-side payment success** — only on webhook confirmation.

## Webhook Events Handled

| Event | Action |
|---|---|
| `subscription.authenticated` | Log only (no access) |
| `subscription.activated` | Set status=active, grant access |
| `subscription.charged` | Extend ends_at, record payment |
| `subscription.pending` | Notify user, maintain current access |
| `subscription.halted` | 3-day grace period, notify user |
| `subscription.cancelled` | Set cancelled, access until period end |
| `subscription.completed` | Set expired |
| `payment.failed` | Notify user |

## Webhook Security

- Signature: `HMAC-SHA256(webhook_secret, raw_body)` verified on every request
- Idempotency: check `payment_events` table for `event_id` before processing
- Raw body read before JSON parse (signature uses raw bytes)
- Webhook URL: `https://learnhub.in/api/webhooks/razorpay`

## Failed Payment Grace Period

- On `subscription.halted`: subscription remains `active` for 3 days
- After grace period: `status = expired` (via pg_cron job), access removed
- User notified in-app + email

## Testing (Razorpay TEST mode)

1. Use `rzp_test_*` keys in `.env.local`
2. Test UPI: use `success@razorpay` as UPI ID
3. Test card: `4111 1111 1111 1111`, any future expiry, any CVV
4. Trigger webhook locally: use Razorpay Dashboard → Webhooks → Retry, or use `ngrok` to expose `localhost:3000`

## Production Checklist

- [ ] Switch to `rzp_live_*` keys
- [ ] Create LIVE plans in Razorpay dashboard, update `RAZORPAY_MONTHLY_PLAN_ID` + `RAZORPAY_YEARLY_PLAN_ID`
- [ ] Set webhook URL to production domain
- [ ] Verify webhook secret matches `RAZORPAY_WEBHOOK_SECRET`
- [ ] Complete Razorpay KYC (requires GST, PAN, bank account)
- [ ] Confirm UPI Intent/QR is enabled for live account
- [ ] Run one real ₹149 transaction and verify full webhook → entitlement flow
