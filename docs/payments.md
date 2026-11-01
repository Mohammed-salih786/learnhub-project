# Payments - LearnHub

LearnHub creates Razorpay orders on the Flask server. Prices are read from active MongoDB plans; the browser never supplies an amount. The existing `amount_cents` field is retained and stores **paise** (₹1 = 100 paise). Only `RAZORPAY_KEY_ID` is returned to the browser. The key secret and webhook secret remain server-side.

## Configuration

Configure these values in the Flask environment (the example file contains blank placeholders):

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Set the monthly and yearly plan amounts in `plans.amount_cents` in paise. Trial plans are not payable through checkout. When keys are absent, order creation returns a clear `Payments are not configured` response and the checkout UI remains usable without crashing.

## Subscription flow

1. The student loads `GET /api/learnhub/student/checkout`.
2. The browser posts `{ "planKey": "monthly" }` (or `yearly`) to `POST /api/learnhub/student/subscribe`.
3. Flask retrieves the active plan, creates a Razorpay order using the server-side amount, and stores a `payments` record with status `created`.
4. The browser opens Razorpay Checkout with the order and public key ID.
5. On checkout completion, the browser posts `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `POST /api/learnhub/student/payments/verify`. Flask checks order ownership, verifies the HMAC-SHA256 signature with `hmac.compare_digest`, and activates the subscription once.
6. The webhook is the server-to-server source of truth if a student closes the checkout before the browser verification finishes. Payment capture and entitlement activation are idempotent.

Monthly and yearly purchases create one-time Razorpay orders and access periods of 30 and 365 days respectively. `POST /api/learnhub/student/subscription/cancel` records cancellation at the end of the current period; access remains valid through `ends_at`. Expiration is enforced at entitlement-read time.

## Webhooks

Configure Razorpay's webhook URL as `https://<your-frontend-host>/api/webhooks/razorpay` (the frontend rewrite proxies it to Flask). Select:

- `payment.captured`
- `payment.failed`
- `order.paid`
- `subscription.charged`
- `subscription.cancelled`
- `refund.processed`

The endpoint signs the exact raw request body against `X-Razorpay-Signature`, returns HTTP 400 for an invalid signature, and deduplicates event IDs in `webhook_events`. Valid retries receive HTTP 200 without repeating entitlement or revenue-share writes.

## Refunds and instructor payouts

Admins can review payments and request a full Razorpay refund from the admin Payments page. A successful refund marks the payment refunded, revokes the subscription created by that payment, and writes an audit log. Razorpay's `refund.processed` webhook also reconciles payment and subscription state.

Instructor revenue is an estimate based on each instructor's share of learner watch minutes and a 70% instructor revenue pool. Shares are snapshotted when a payment is captured, then admins can record a bank-transfer reference when marking pending shares as paid. These application records do not trigger a bank transfer.

## Test mode

1. Create a Razorpay account and enable Test Mode. Copy the test key ID, key secret, and a webhook signing secret into the Flask environment. Do not use live keys in local development.
2. Start Flask and the web app. Confirm that the monthly/yearly plans have non-zero `amount_cents` values in paise.
3. In the Razorpay dashboard, add a webhook endpoint pointing to the public frontend proxy URL. For local testing, expose the web app with a tunnel such as ngrok (for example `ngrok http 3000`) and configure the resulting HTTPS URL plus `/api/webhooks/razorpay`. Use the same webhook secret in Flask and the dashboard.
4. Sign in as a student, open `/student/checkout`, and select a paid plan. In Razorpay Checkout use test card `4111 1111 1111 1111`, a future expiry date, and any three-digit CVV; use the test OTP displayed by Razorpay's test flow.
5. Confirm the subscription and captured payment appear in the student's Billing page and admin Payments page. Verify the webhook delivery in Razorpay's dashboard.
6. To test a webhook without the dashboard, create a pending order through checkout and run:

   ```powershell
   $env:RAZORPAY_WEBHOOK_SECRET = "your-test-webhook-secret"
   py backend\scripts\simulate_webhook.py --order-id order_test_id --payment-id pay_test_id
   ```

   Supply the actual order ID from a pending `payments` record. The simulator signs its sample event and posts it to local Flask by default; pass `--url https://<tunnel>/api/webhooks/razorpay` to use a tunnel. Do not use a fabricated payment ID to validate a real Razorpay signature; the simulator only tests webhook signature handling and event processing.

7. Test admin refund and payout actions with test payments before enabling live mode.

The simulator does not contact Razorpay or create a payment. It only creates a signed test webhook event.
