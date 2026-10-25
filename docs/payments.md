# Payments - LearnHub

The Flask API stores plans, subscriptions, payment records, and webhook events in MongoDB. `POST /api/learnhub/student/subscribe` currently returns the selected plan and reports whether Razorpay credentials are present; it does not create a hosted checkout yet. Do not accept live payments until checkout creation, payment confirmation, and entitlement updates have been completed and verified.

The Razorpay webhook endpoint verifies `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET` and deduplicates event IDs in `payment_events`. Configure the provider webhook to the frontend URL `/api/webhooks/razorpay`, which proxies to Flask.

The seed plans are trial (7 days), monthly, and yearly. `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, monthly/yearly plan IDs, and the webhook secret are server-side only.
