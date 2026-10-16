/**
 * Thin typed DB helpers used by API routes.
 * All functions use the service-role client to bypass RLS for server-side
 * operations that have already validated entitlements in code.
 */

import { createServerSupabaseClient } from "./supabase";

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export async function getProfileById(userId: string) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function upsertProfile(profile: {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  role?: string;
}) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("profiles")
    .upsert(profile, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function getPublishedCourses(opts?: {
  search?: string;
  category?: string;
  sort?: "trending" | "newest" | "top_rated" | "most_enrolled";
  limit?: number;
  offset?: number;
}) {
  const db = createServerSupabaseClient();
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  let query = db
    .from("courses")
    .select(`
      id, title, slug, short_description, thumbnail_url,
      published_at, status,
      instructor:profiles!instructor_id(id, full_name, avatar_url),
      category:categories!category_id(id, name, slug),
      total_enrollments:enrollments(count),
      avg_rating:reviews(rating.avg()),
      review_count:reviews(count)
    `)
    .eq("status", "published");

  if (opts?.search) {
    query = query.textSearch("search_vector", opts.search, { type: "websearch" });
  }
  if (opts?.category) {
    query = query.eq("categories.slug", opts.category);
  }

  switch (opts?.sort) {
    case "newest":
      query = query.order("published_at", { ascending: false });
      break;
    case "top_rated":
      // Postgres aggregates can't be sorted directly in PostgREST, handled by view
      query = query.order("published_at", { ascending: false });
      break;
    default:
      query = query.order("published_at", { ascending: false });
  }

  const { data, error } = await query.range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

export async function getCourseBySlug(slug: string) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("courses")
    .select(`
      *,
      instructor:profiles!instructor_id(id, full_name, avatar_url, email),
      instructor_profile:instructor_profiles!user_id(bio, headline, verified_badge),
      category:categories!category_id(id, name, slug),
      modules(id, title, sort_order,
        lessons(id, title, summary, preview, is_paid, duration_seconds, sort_order)
      ),
      tests(id, title, total_marks),
      reviews(id, rating, review_text, created_at, user:profiles!user_id(full_name, avatar_url))
    `)
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function getCoursesByInstructor(instructorId: string) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("courses")
    .select(`
      *,
      modules(id, title, sort_order,
        lessons(id, title, sort_order, duration_seconds, preview, is_paid)
      ),
      enrollments(count),
      reviews(rating)
    `)
    .eq("instructor_id", instructorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function getLessonById(lessonId: string) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("lessons")
    .select(`
      *,
      course:courses!course_id(id, title, slug, instructor_id, status),
      resources:lesson_resources(id, name, file_url, resource_type)
    `)
    .eq("id", lessonId)
    .single();
  if (error) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Subscriptions / Entitlements
// ---------------------------------------------------------------------------

export async function getActiveSubscription(userId: string) {
  const db = createServerSupabaseClient();
  const { data } = await db
    .from("subscriptions")
    .select(`*, plan:plans!plan_id(key, label, amount_cents)`)
    .eq("user_id", userId)
    .in("status", ["active", "trial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data ?? null;
}

export async function getUserEntitlementContext(userId: string) {
  const db = createServerSupabaseClient();

  const [profileRes, subRes] = await Promise.all([
    db.from("profiles").select("role, trial_ends_at, free_course_count").eq("id", userId).single(),
    getActiveSubscription(userId)
  ]);

  const profile = profileRes.data;
  if (!profile) return null;

  const now = new Date();
  const hasActiveTrial =
    !!profile.trial_ends_at && new Date(profile.trial_ends_at) > now && subRes?.status === "trial";
  const hasActiveSubscription =
    subRes?.status === "active" && (!subRes.ends_at || new Date(subRes.ends_at) > now);

  return {
    role: profile.role as string,
    hasActiveSubscription,
    hasActiveTrial,
    freeCoursesConsumed: profile.free_course_count ?? 0,
    freeCourseLimit: Number(process.env.TRIAL_FREE_COURSE_LIMIT ?? 2),
    planKey: (subRes?.plan as { key?: string } | null)?.key ?? null
  };
}

// ---------------------------------------------------------------------------
// Lesson Progress
// ---------------------------------------------------------------------------

export async function upsertLessonProgress(opts: {
  userId: string;
  lessonId: string;
  percentComplete: number;
  lastPositionSeconds: number;
  completed?: boolean;
}) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("lesson_progress")
    .upsert(
      {
        user_id: opts.userId,
        lesson_id: opts.lessonId,
        percent_complete: opts.percentComplete,
        last_position_seconds: opts.lastPositionSeconds,
        completed: opts.completed ?? opts.percentComplete >= 90,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id,lesson_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export async function getTestWithQuestions(testId: string) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("tests")
    .select(`*, questions(id, question_type, prompt, options, answer_key, marks, explanation)`)
    .eq("id", testId)
    .single();
  if (error) return null;
  return data;
}

export async function getTestAttemptCount(userId: string, testId: string) {
  const db = createServerSupabaseClient();
  const { count } = await db
    .from("test_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("test_id", testId);
  return count ?? 0;
}

export async function saveTestAttempt(opts: {
  userId: string;
  testId: string;
  score: number;
  scorePercent: number;
  passed: boolean;
  breakdown: unknown;
}) {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("test_attempts")
    .insert({
      user_id: opts.userId,
      test_id: opts.testId,
      score: opts.score,
      submitted_at: new Date().toISOString(),
      attempts_count: 1
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function canUserReview(userId: string, courseId: string): Promise<boolean> {
  const db = createServerSupabaseClient();

  // Must be enrolled
  const { data: enrollment } = await db
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .single();

  if (!enrollment) return false;

  // Must have watched at least 30% of lessons
  const { data: lessons } = await db
    .from("lessons")
    .select("id")
    .eq("course_id", courseId);

  if (!lessons || lessons.length === 0) return false;

  const { data: progress } = await db
    .from("lesson_progress")
    .select("percent_complete")
    .eq("user_id", userId)
    .in("lesson_id", lessons.map((l) => l.id));

  const totalProgress = (progress ?? []).reduce((sum, p) => sum + (p.percent_complete ?? 0), 0);
  const avgProgress = totalProgress / lessons.length;

  return avgProgress >= 30;
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function getActivePlans() {
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("amount_cents", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function createNotification(opts: {
  userId: string;
  kind: string;
  message: string;
}) {
  const db = createServerSupabaseClient();
  await db.from("notifications").insert({
    user_id: opts.userId,
    kind: opts.kind,
    message: opts.message
  });
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

export async function getAdminOverviewStats() {
  const db = createServerSupabaseClient();

  const [
    subscribersRes,
    instructorsRes,
    pendingModerationRes,
    revenueRes,
    signupsThisMonthRes,
    activeNowRes
  ] = await Promise.all([
    db
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "instructor"),
    db
      .from("moderation_flags")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("payments")
      .select("amount_cents")
      .eq("status", "captured"),
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    db
      .from("engagement_events")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
  ]);

  const totalRevenuePaise = (revenueRes.data ?? []).reduce(
    (sum, p) => sum + (p.amount_cents ?? 0),
    0
  );

  return {
    totalSubscribers: subscribersRes.count ?? 0,
    activeInstructors: instructorsRes.count ?? 0,
    pendingModeration: pendingModerationRes.count ?? 0,
    totalRevenuePaise,
    signupsThisMonth: signupsThisMonthRes.count ?? 0,
    activeUsersNow: activeNowRes.count ?? 0
  };
}
