# LearnHub Architecture

## Overview

LearnHub is a monorepo-based subscription learning marketplace targeting India-first mobile users.

```
learning platform/
├── apps/web/          → Next.js 14 App Router (TypeScript strict)
├── packages/shared/   → Pure TS: Zod schemas, grading, entitlement, revenue, cert logic
├── supabase/          → DB migrations, RLS policies, seed data
└── docs/              → Architecture, DB schema, API, payments, video, runbooks
```

## Stack Decisions

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 App Router | SSR + API routes in one deploy, Vercel-optimized |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, mobile-first at 360px |
| Auth | Supabase Auth (phone OTP, email OTP, Google) | Built-in OTP, RLS integration |
| Database | Supabase Postgres | RLS, Realtime, Storage, pg_cron all bundled |
| Video | Bunny Stream | Affordable CDN, HLS, TUS resumable upload, signed URLs |
| Payments | Razorpay Subscriptions | India-native, UPI support, webhook-driven entitlement |
| Email | Resend | Deliverability, simple API |
| SMS OTP | MSG91 | DLT-compliant in India |
| Analytics | PostHog | Self-hostable, funnel support |
| Errors | Sentry | Source maps, alerting |
| CI/CD | GitHub Actions + Vercel | PR checks, staging auto-deploy, production on tag |

## Request Flow

```
Browser → Next.js middleware (role guard via cookie)
        → Server Component / Route Handler
        → Supabase (Postgres RLS enforced)
        → External services (Bunny, Razorpay, Resend, MSG91)
```

## Entitlement Model

```
canAccessLesson():
  1. preview lesson → always allowed
  2. free (non-paid) lesson → always allowed  
  3. active subscription (monthly/yearly) → allowed
  4. active trial + freeCoursesConsumed < 2 → allowed
  5. else → denied → redirect to /student/checkout
```

Entitlement is checked **server-side only** on every lesson fetch. Signed video URLs are issued only after the check passes and expire in 15 minutes.

## Deployment Environments

| Env | Supabase | Vercel | Notes |
|---|---|---|---|
| Local dev | Local Docker (`localhost:54321`) | `next dev` | Demo OTP 123456 |
| Staging | Separate Supabase project | Vercel preview | Razorpay TEST keys |
| Production | Separate Supabase project | Vercel production | Razorpay LIVE keys |

## Security Properties

- RLS on all 23 tables — no table is accessible without an explicit policy
- Role/trial fields protected by DB trigger (`prevent_role_trial_change`)
- Webhook signature verified with HMAC-SHA256 before any processing
- Idempotent webhooks via `payment_events` dedup
- Signed video URLs issued server-side, expire in 15 min, domain-locked via Bunny CDN settings
- Secrets in env vars only — never committed
- Rate limiting: implement at edge layer (Vercel Edge Middleware / Upstash) before launch
