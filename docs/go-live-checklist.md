# Go-Live Checklist — LearnHub

## Infrastructure
- [ ] Supabase production project created (separate from staging)
- [ ] All migrations applied to production: `supabase db push`
- [ ] Seed data applied: categories and plans (no demo users)
- [ ] Storage buckets created: `certificates`, `notes`, `course-assets`
- [ ] pg_cron enabled (Settings → Database → Extensions) and cron jobs activated (uncomment in migration 002)
- [ ] Supabase custom auth domain configured (Settings → Auth → SMTP)
- [ ] Vercel production project linked to repository
- [ ] Environment variables set in Vercel (production)

## Auth
- [ ] Google OAuth client ID/secret configured for production domain
- [ ] Google OAuth redirect URI: `https://learnhub.in/auth/callback`
- [ ] MSG91 DLT templates approved (takes 1-3 business days)
- [ ] MSG91 sender ID `LEARNHUB` activated
- [ ] Phone OTP tested on a real phone number
- [ ] Email OTP tested with a real inbox

## Payments
- [ ] Razorpay KYC completed (GST, PAN, bank account)
- [ ] Live keys activated: `rzp_live_*`
- [ ] Monthly and yearly plans created in Razorpay Live dashboard
- [ ] `RAZORPAY_MONTHLY_PLAN_ID` and `RAZORPAY_YEARLY_PLAN_ID` set in production env
- [ ] Webhook URL set: `https://learnhub.in/api/webhooks/razorpay`
- [ ] Webhook secret set and verified
- [ ] UPI Intent/QR enabled on live account
- [ ] ₹149 real payment test completed and refunded
- [ ] Certificate issued after yearly plan purchase (test)

## Video
- [ ] Bunny Stream production library created (separate from staging)
- [ ] Security key (signed URL) configured
- [ ] Pull zone domain lock set to `learnhub.in`
- [ ] One test video uploaded and played back through signed URL
- [ ] Bunny storage zone set to `AP-South` region

## Email / SMS
- [ ] Resend domain verified (SPF, DKIM, DMARC for `learnhub.in`)
- [ ] From address `hello@learnhub.in` confirmed
- [ ] Test email sent and received in inbox (not spam)
- [ ] Renewal reminder email tested
- [ ] Payment failed email tested

## DNS & Domain
- [ ] Domain `learnhub.in` pointed to Vercel (A / CNAME records)
- [ ] HTTPS certificate issued (Vercel auto)
- [ ] `www.learnhub.in` → `learnhub.in` redirect configured
- [ ] SPF record: `v=spf1 include:amazonses.com ~all` (Resend via SES)
- [ ] DKIM record added (from Resend dashboard)
- [ ] DMARC record: `v=DMARC1; p=quarantine; rua=mailto:admin@learnhub.in`

## Observability
- [ ] Sentry production project created, DSN set in production env
- [ ] Sentry error alert configured (Slack/email for new issues)
- [ ] PostHog production project key set in production env
- [ ] Uptime monitor configured (UptimeRobot or Vercel) for `https://learnhub.in/api/health`
- [ ] Payment failure alert: Sentry issue alert on webhook handler errors
- [ ] Daily Supabase backup confirmed (Pro tier)
- [ ] Restore drill completed at least once

## Legal Pages (requires lawyer review before launch)
- [ ] `/privacy` — Privacy Policy (DPDP Act 2023 compliant)
- [ ] `/terms` — Terms of Service
- [ ] `/refund` — Refund and Cancellation Policy
- [ ] `/grievance` — Grievance officer contact
- [ ] Cookie consent banner live on landing page
- [ ] Account deletion flow tested (`DELETE /api/student/account`)

## Content
- [ ] At least 2 courses published (to support free trial)
- [ ] All course thumbnails uploaded
- [ ] Test attempts work with real question banks
- [ ] Certificates generate and are emailed correctly
- [ ] Admin moderation queue working

## Final Smoke Test (on production, real phone + laptop)
- [ ] New user signup via phone OTP
- [ ] Role selection works
- [ ] Trial starts automatically
- [ ] Browse catalog
- [ ] Preview lesson plays without subscription
- [ ] Paywall shown for non-preview lessons
- [ ] Subscribe (monthly) via UPI
- [ ] Access unlocked after webhook
- [ ] Lesson plays with signed URL
- [ ] Progress heartbeat saves (check DB)
- [ ] Subscribe (yearly), complete a course → certificate generated
- [ ] Instructor: sign up, create course, upload video, publish
- [ ] Admin: approve course, grant verified badge, edit plan price

## Post-Launch (first 60 days)
- Week 1: Soft launch with 5-10 instructors + 20-30 invited students
- Week 2: Monitor Sentry, PostHog funnel, subscription.activated webhook rate
- Week 3: Fix feedback, improve onboarding if conversion < 5%
- Week 4: Public launch announcement
- Month 2: Target 100 paying subscribers; monitor churn, fix top drop-off points
