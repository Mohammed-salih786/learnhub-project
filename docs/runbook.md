# Runbook — LearnHub

## Incident Response

### Site is down
1. Check Vercel status: https://www.vercel-status.com
2. Check Supabase status: https://status.supabase.com
3. Check latest deployment in Vercel dashboard for errors
4. Run: `curl https://learnhub.in/api/health` — should return `{"ok":true}`
5. If Vercel is up but app returns 500: check Sentry for recent errors
6. Roll back to previous Vercel deployment if needed (Vercel Dashboard → Deployments → Promote)

### Webhook failures
1. Check `payment_events` table for recent events and their payloads
2. Replay via Razorpay Dashboard → Settings → Webhooks → Event Log → Retry
3. Or manually insert a payment event and trigger the handler logic
4. Verify `RAZORPAY_WEBHOOK_SECRET` env var matches the Razorpay dashboard secret

### User can't access a course after payment
1. Check `subscriptions` table: `SELECT * FROM subscriptions WHERE user_id = 'USER_ID';`
2. Check `payment_events` for `subscription.activated` event for this user
3. If activation event missing: replay from Razorpay dashboard
4. If subscription status is wrong: manually update via service role (admin only)

### OTP not delivering
1. Check MSG91 dashboard for delivery logs
2. Verify DLT template is approved and sender ID is active
3. Test with a personal number to isolate the issue
4. If MSG91 is down: Supabase Auth has built-in email OTP as fallback

## Key Rotation

### Rotate Razorpay webhook secret
1. Generate new secret in Razorpay Dashboard → Settings → Webhooks
2. Update `RAZORPAY_WEBHOOK_SECRET` in Vercel environment variables
3. Redeploy: `git tag v1.x.x && git push --tags`
4. Verify webhook signature in next payment event

### Rotate Supabase service role key
1. Generate new key in Supabase Dashboard → Settings → API
2. Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables
3. Redeploy immediately (old key is still valid for 24h in Supabase)

### Rotate Bunny API key
1. Generate new key in Bunny Dashboard → Account → API Key
2. Update `BUNNY_API_KEY` in Vercel environment variables
3. Redeploy

## Database Backups

Supabase takes daily backups automatically (Pro tier). To restore:
1. Supabase Dashboard → Project → Backups
2. Select restore point
3. Click "Restore" — this replaces the current database
4. After restore: verify `plans` and `categories` seed data is intact

### Manual backup before migration
```bash
pg_dump $SUPABASE_DB_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Running Migrations

```bash
# Local
npx supabase db push

# Production (via CI)
# Migrations run automatically on tag push via GitHub Actions
# See .github/workflows/deploy.yml
```

## Useful Queries

```sql
-- Active subscribers count
SELECT COUNT(*) FROM subscriptions WHERE status = 'active';

-- MRR
SELECT 
  SUM(CASE WHEN p.key = 'monthly' THEN 14900 ELSE 0 END) +
  SUM(CASE WHEN p.key = 'yearly' THEN ROUND(99900/12.0) ELSE 0 END) as mrr_paise
FROM subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.status = 'active';

-- Recent payment failures
SELECT * FROM payment_events 
WHERE event_type = 'payment.failed' 
ORDER BY received_at DESC 
LIMIT 20;

-- Users with access issues
SELECT p.id, p.email, p.role, s.status, s.ends_at
FROM profiles p
LEFT JOIN subscriptions s ON s.user_id = p.id
WHERE s.status IS NULL OR s.ends_at < NOW()
ORDER BY p.created_at DESC
LIMIT 50;
```
