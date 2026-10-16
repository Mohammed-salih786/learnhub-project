# LearnHub — Accounts & Vendor Setup Checklist

This checklist is for Phase 0 and is intentionally document-first. Nothing below should be implemented until the required accounts and access are confirmed.

## 1) Product / business setup

- Brand: LearnHub
- Domain target: learnhub.in (or the approved brand domain, if different)
- Legal entity for Razorpay KYC: business entity required by the Razorpay onboarding flow; use the registered company/LLP name that will hold the merchant account
- GST status: India-facing subscription platform; enable GST-compliant billing and receipts
- Tax treatment: prices displayed are GST-inclusive for the Indian market

## 2) Core platform accounts

### Supabase
- Owner: Product/engineering lead
- Purpose: Postgres, Auth, Storage, Realtime, Edge Functions, cron
- Cost: free dev + paid project tiers for staging/production
- Lead time: 1-3 days
- Phase blocked: Phase 1 onward
- Required items:
  - staging project
  - production project
  - service role key
  - anon key
  - database connection strings
  - storage bucket(s) for course assets and certificates
  - custom domain if needed

### Vercel
- Owner: engineering lead / platform owner
- Purpose: Next.js app hosting for web frontend
- Cost: paid team plan recommended for preview + production
- Lead time: 1 day
- Phase blocked: Phase 1 onward
- Required items:
  - GitHub repo connection
  - production and preview environment setup
  - domain mapping and DNS verification

### GitHub
- Owner: engineering lead / ops
- Purpose: monorepo, CI/CD, branch protection, code reviews
- Cost: free for public or paid org workspace
- Lead time: 1 day
- Phase blocked: Phase 1 onward
- Required items:
  - repo creation
  - GitHub Actions workflow
  - environment secrets for staging and production

## 3) Content delivery and video

### Bunny Stream
- Owner: video/platform integration owner
- Purpose: video hosting, signed playback URLs, resumable TUS upload from browser
- Cost: pay-as-you-go based on storage/traffic
- Lead time: 2-5 days, depending on onboarding and TUS configuration
- Phase blocked: Phase 3 onward
- Required items:
  - API key
  - library ID
  - API hostname / region
  - video storage zone
  - playback URL domain configuration
  - webhook endpoint setup for processing/ready/failed states

## 4) Payments and compliance

### Razorpay
- Owner: finance + legal + engineering
- Purpose: subscription billing and webhooks
- Cost: standard Razorpay fees + compliance/KYC costs if applicable
- Lead time: 1-3 weeks depending on KYC and merchant verification
- Phase blocked: Phase 5+ (payments and subscriptions) and all paid launch gating
- Required items:
  - test key pair
  - live key pair
  - webhook secret
  - subscription plan creation
  - UPI intent/QR setup notes for Indian users
  - business verification and KYC documents
  - payment dashboard ownership and bank account mapping

### GST and tax compliance
- Owner: finance / accountant
- Purpose: invoice, tax treatment and tax-inclusive pricing
- Cost: accounting support, if external
- Lead time: 2-7 days
- Phase blocked: launch readiness
- Required items:
  - GST registration details
  - invoice structure
  - tax-inclusive pricing policy
  - refund and sales policy approval

## 5) OTP and communications

### SMS OTP provider (MSG91 or Twilio)
- Owner: engineering + compliance owner
- Purpose: phone OTP authentication
- Cost: per SMS; DLT registration required in India
- Lead time: 5-15 days depending on DLT setup
- Phase blocked: Phase 2 login/auth launch
- Required items:
  - sender ID / route details
  - DLT registration and entity verification
  - API credentials
  - template approval

### Resend
- Owner: product and platform owner
- Purpose: transactional email delivery for onboarding, payment, notifications
- Cost: usage-based
- Lead time: 1-2 days
- Phase blocked: Phase 2+ and user communication workflows
- Required items:
  - API key
  - sender domain verification
  - email templates

## 6) Analytics and product monitoring

### PostHog
- Owner: product/marketing analytics
- Purpose: product analytics, funnels, event tracking, key conversion metrics
- Cost: usage-based or paid plan
- Lead time: 1 day
- Phase blocked: Phase 1 instrumentation and all KPI dashboards
- Required items:
  - project API key
  - event taxonomy
  - staging and production project separation

### Sentry
- Owner: engineering
- Purpose: error tracking, performance monitoring, release health
- Cost: usage-based or paid plan
- Lead time: 1 day
- Phase blocked: Phase 1 and live monitoring
- Required items:
  - DSN / organization slug
  - team ownership
  - alert rules

## 7) Domain and DNS

- Owner: technical owner / domain registrar / hosting provider
- Purpose: public web app, marketing, API callback endpoints
- Cost: domain annual fee + DNS management
- Lead time: 1-7 days
- Phase blocked: launch readiness and payment callback setup
- Required items:
  - primary domain (e.g., learnhub.in)
  - apex/root A/CNAME records
  - staging subdomain (e.g., staging.learnhub.in)
  - wildcard certificate / Vercel-managed TLS
  - Buy, configure, and approve all required records for Supabase, Vercel, and Razorpay webhook endpoints

## 8) Operational approvals

- Owner: business/legal owner
- Purpose: content policies, refund approvals, subscription terms, instructor guidelines
- Cost: legal/compliance review as needed
- Lead time: 3-10 days
- Phase blocked: pre-launch legal readiness
- Required items:
  - refund policy approval
  - instructor content policy
  - course moderation policy
  - user privacy / consent notices

## 9) Deliverables for launch readiness

The app cannot be made live until all of the following are complete:

- Supabase staging + production projects are active and secure
- Vercel app is live for production and staging
- Razorpay KYC and live keys are approved
- Webhooks are configured and tested
- OTP provider is approved for India and DLT is in place
- Domain DNS and HTTPS are live
- PostHog and Sentry are configured
- Production env vars are created, backed up, and separated from staging

## 10) Phase gating summary

- Phase 0 deliverable: all accounts and approved decisions documented
- Phase 1 blocked by: Supabase, GitHub, Vercel, PostHog, Sentry
- Phase 2 blocked by: Auth & OTP provider setup, Supabase auth configuration
- Phase 3 blocked by: Bunny Stream and instructor onboarding flow
- Phase 4+ blocked by: Razorpay live activation, domain readiness, payment webhooks, production launch validation
