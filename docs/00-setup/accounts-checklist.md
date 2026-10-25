# Accounts and Vendor Setup

## Product
- Confirm LearnHub brand and domain.
- Confirm the India-registered legal entity, GST setup, and pricing policy.
- Review privacy, terms, refund, and moderation requirements.

## Hosting and database
- Provision MongoDB Atlas databases for staging and production.
- Create restricted database users, network access rules, and backup policies.
- Provision Python hosting for the Flask API and Next.js hosting for the frontend.
- Configure `MONGODB_URI`, `MONGODB_DATABASE`, `JWT_SECRET`, `ADMIN_EMAIL`, and `FLASK_API_URL` per environment.
- Keep secrets out of source control and client-side environment variables.

## Optional providers
- Razorpay: KYC, test/live keys, plans, and webhook secret.
- Email sender: verified domain and sender identity.
- Bunny Stream or another video provider: storage and playback credentials.
- PostHog/Sentry: project ownership and environment-specific keys.
