-- ============================================================
-- Migration 002: RLS Hardening, Full-Text Search, Indexes,
--                Audit Log Trigger, pg_cron Jobs
-- ============================================================

-- ============================================================
-- 1. PROTECT ROLE AND TRIAL DATES — users must never change these
-- ============================================================

-- Drop the permissive update policy and replace with a column-filtered one.
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Allow users to update their own profile but NEVER role or trial fields.
-- We enforce this via a trigger.
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to block self-modification of role, trial dates, and free_course_count
CREATE OR REPLACE FUNCTION prevent_role_trial_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Only the service role (backend) may change role, trial dates, or free_course_count
  IF current_setting('role') != 'service_role' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'role cannot be changed by the user';
    END IF;
    IF NEW.trial_starts_at IS DISTINCT FROM OLD.trial_starts_at THEN
      RAISE EXCEPTION 'trial_starts_at cannot be changed by the user';
    END IF;
    IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
      RAISE EXCEPTION 'trial_ends_at cannot be changed by the user';
    END IF;
    IF NEW.free_course_count IS DISTINCT FROM OLD.free_course_count THEN
      RAISE EXCEPTION 'free_course_count cannot be changed by the user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_trial_change ON profiles;
CREATE TRIGGER trg_prevent_role_trial_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_trial_change();

-- Subscription status may only be updated by the service role (webhook handler)
CREATE OR REPLACE FUNCTION prevent_subscription_self_modify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF current_setting('role') != 'service_role' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'subscription status can only be changed by the server';
    END IF;
    IF NEW.ends_at IS DISTINCT FROM OLD.ends_at THEN
      RAISE EXCEPTION 'subscription end date can only be changed by the server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_subscription_self_modify ON subscriptions;
CREATE TRIGGER trg_prevent_subscription_self_modify
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION prevent_subscription_self_modify();

-- ============================================================
-- 2. ADMIN POLICIES — admins can read everything they need
-- ============================================================

-- Admins see all subscriptions
DROP POLICY IF EXISTS "subscriptions_admin_all" ON subscriptions;
CREATE POLICY "subscriptions_admin_all" ON subscriptions
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all payments
DROP POLICY IF EXISTS "payments_admin_all" ON payments;
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all payment events
DROP POLICY IF EXISTS "payment_events_admin_all" ON payment_events;
CREATE POLICY "payment_events_admin_all" ON payment_events
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all enrollments
DROP POLICY IF EXISTS "enrollments_admin_all" ON enrollments;
CREATE POLICY "enrollments_admin_all" ON enrollments
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all test attempts
DROP POLICY IF EXISTS "test_attempts_admin_all" ON test_attempts;
CREATE POLICY "test_attempts_admin_all" ON test_attempts
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all notifications
DROP POLICY IF EXISTS "notifications_admin_all" ON notifications;
CREATE POLICY "notifications_admin_all" ON notifications
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all certificates
DROP POLICY IF EXISTS "certificates_admin_all" ON certificates;
CREATE POLICY "certificates_admin_all" ON certificates
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Admins see all profiles
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Instructors can see enrollments for their own courses
DROP POLICY IF EXISTS "enrollments_instructor_courses" ON enrollments;
CREATE POLICY "enrollments_instructor_courses" ON enrollments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_id AND c.instructor_id = auth.uid()
    )
  );

-- Instructors can see test attempts for their own courses
DROP POLICY IF EXISTS "test_attempts_instructor_courses" ON test_attempts;
CREATE POLICY "test_attempts_instructor_courses" ON test_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tests t
      JOIN courses c ON c.id = t.course_id
      WHERE t.id = test_id AND c.instructor_id = auth.uid()
    )
  );

-- Certificates: public read for verification page (verify by certificate id)
DROP POLICY IF EXISTS "certificates_public_verify" ON certificates;
CREATE POLICY "certificates_public_verify" ON certificates
  FOR SELECT
  USING (true);

-- Moderation flags: instructors can read flags on their own courses
DROP POLICY IF EXISTS "moderation_flags_instructor_read" ON moderation_flags;
CREATE POLICY "moderation_flags_instructor_read" ON moderation_flags
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_id AND c.instructor_id = auth.uid()
    )
  );

-- ============================================================
-- 3. FULL-TEXT SEARCH on courses
-- ============================================================

-- Add a generated tsvector column for fast FTS
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(short_description, '')), 'B') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_courses_search_vector ON courses USING GIN(search_vector);

-- ============================================================
-- 4. ADDITIONAL PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_published_at ON courses(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_modules_course_order ON modules(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_module_order ON lessons(module_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_course_order ON lessons(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user_test ON test_attempts(user_id, test_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay ON subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_event_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_user ON engagement_events(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_name ON engagement_events(event_name);
CREATE INDEX IF NOT EXISTS idx_follows_instructor ON follows(instructor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(course_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_status ON moderation_flags(status);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON admin_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);

-- ============================================================
-- 5. ADMIN AUDIT LOG TRIGGER
-- Automatically logs admin actions on sensitive tables.
-- ============================================================

CREATE OR REPLACE FUNCTION log_admin_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  actor UUID;
BEGIN
  actor := auth.uid();
  -- Only log when an authenticated admin is performing the action
  IF actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO admin_audit_log(actor_id, action, target_type, target_id, details)
  VALUES (
    actor,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(
      (CASE TG_OP WHEN 'DELETE' THEN OLD.id ELSE NEW.id END),
      gen_random_uuid()
    ),
    jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW),
      'table', TG_TABLE_NAME
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach audit trigger to sensitive admin-operated tables
DROP TRIGGER IF EXISTS trg_audit_moderation_flags ON moderation_flags;
CREATE TRIGGER trg_audit_moderation_flags
  AFTER INSERT OR UPDATE OR DELETE ON moderation_flags
  FOR EACH ROW EXECUTE FUNCTION log_admin_action();

DROP TRIGGER IF EXISTS trg_audit_plans ON plans;
CREATE TRIGGER trg_audit_plans
  AFTER INSERT OR UPDATE OR DELETE ON plans
  FOR EACH ROW EXECUTE FUNCTION log_admin_action();

DROP TRIGGER IF EXISTS trg_audit_instructor_profiles ON instructor_profiles;
CREATE TRIGGER trg_audit_instructor_profiles
  AFTER UPDATE ON instructor_profiles
  FOR EACH ROW EXECUTE FUNCTION log_admin_action();

-- ============================================================
-- 6. UPDATED_AT AUTO-MAINTENANCE
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_lesson_progress_updated_at ON lesson_progress;
CREATE TRIGGER trg_lesson_progress_updated_at
  BEFORE UPDATE ON lesson_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 7. ENROLLMENT GUARD — prevent double-enrolling and enforce trial quota
-- ============================================================

CREATE OR REPLACE FUNCTION check_enrollment_eligibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_free_count INTEGER;
  v_subscription_status TEXT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  -- Get student's current subscription status
  SELECT status INTO v_subscription_status
  FROM subscriptions
  WHERE user_id = NEW.user_id
    AND status = 'active'
  LIMIT 1;

  -- If active paid subscription, allow enrollment
  IF v_subscription_status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Check trial eligibility
  SELECT trial_ends_at, free_course_count
  INTO v_trial_ends, v_free_count
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_trial_ends IS NOT NULL AND NOW() <= v_trial_ends THEN
    IF v_free_count < 2 THEN
      -- Increment free course count
      UPDATE profiles SET free_course_count = free_course_count + 1 WHERE id = NEW.user_id;
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'trial_quota_exceeded: Free trial course limit reached. Subscribe to continue.';
    END IF;
  END IF;

  RAISE EXCEPTION 'not_entitled: An active subscription or trial is required to enroll.';
END;
$$;

DROP TRIGGER IF EXISTS trg_check_enrollment ON enrollments;
CREATE TRIGGER trg_check_enrollment
  BEFORE INSERT ON enrollments
  FOR EACH ROW EXECUTE FUNCTION check_enrollment_eligibility();

-- ============================================================
-- 8. pg_cron JOBS (requires pg_cron extension)
-- Uncomment these after enabling pg_cron in Supabase dashboard.
-- ============================================================

-- SELECT cron.schedule(
--   'expire-trials',
--   '0 2 * * *',  -- 2am UTC daily
--   $$
--     UPDATE subscriptions
--     SET status = 'expired'
--     WHERE status = 'trial'
--       AND ends_at IS NOT NULL
--       AND ends_at < NOW();
--   $$
-- );

-- SELECT cron.schedule(
--   'renewal-reminder',
--   '0 9 * * *',  -- 9am UTC daily
--   $$
--     INSERT INTO notifications(user_id, kind, message)
--     SELECT s.user_id,
--            'renewal_reminder',
--            'Your LearnHub subscription renews in 3 days. Ensure your payment method is up to date.'
--     FROM subscriptions s
--     WHERE s.status = 'active'
--       AND s.ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
--       AND NOT EXISTS (
--         SELECT 1 FROM notifications n
--         WHERE n.user_id = s.user_id
--           AND n.kind = 'renewal_reminder'
--           AND n.created_at > NOW() - INTERVAL '24 hours'
--       );
--   $$
-- );

-- SELECT cron.schedule(
--   'expire-grace-subscriptions',
--   '*/30 * * * *',  -- every 30 min
--   $$
--     UPDATE subscriptions
--     SET status = 'expired'
--     WHERE status = 'active'
--       AND ends_at IS NOT NULL
--       AND ends_at < NOW() - INTERVAL '3 days'; -- 3-day grace period after end
--   $$
-- );

-- ============================================================
-- 9. COURSE STATS VIEW (for catalog sort by enrollment/rating)
-- ============================================================

CREATE OR REPLACE VIEW course_stats AS
SELECT
  c.id                                                        AS course_id,
  c.title,
  c.slug,
  c.instructor_id,
  c.status,
  c.published_at,
  COUNT(DISTINCT e.id)                                        AS total_enrollments,
  COALESCE(AVG(r.rating), 0)::NUMERIC(3,1)                   AS avg_rating,
  COUNT(DISTINCT r.id)                                        AS review_count,
  COALESCE(SUM(lp.percent_complete), 0)                      AS total_watch_percent,
  COUNT(DISTINCT lp.user_id)                                  AS unique_watchers
FROM courses c
LEFT JOIN enrollments e  ON e.course_id = c.id
LEFT JOIN reviews r      ON r.course_id = c.id
LEFT JOIN lessons l      ON l.course_id = c.id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
GROUP BY c.id;

-- ============================================================
-- 10. INSTRUCTOR EARNINGS VIEW
-- ============================================================

CREATE OR REPLACE VIEW instructor_earnings AS
SELECT
  c.instructor_id,
  SUM(lp.percent_complete)    AS total_watch_percent_sum,
  COUNT(DISTINCT e.user_id)   AS total_students
FROM courses c
LEFT JOIN lessons l      ON l.course_id = c.id
LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
LEFT JOIN enrollments e  ON e.course_id = c.id
GROUP BY c.instructor_id;
