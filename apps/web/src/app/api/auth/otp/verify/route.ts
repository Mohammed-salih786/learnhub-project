import { NextResponse } from "next/server";
import { z } from "zod";

import { createAnonServerSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";

const verifySchema = z
  .object({
    method: z.enum(["phone-otp", "email-otp"]),
    phone: z.string().min(10).max(25).optional(),
    email: z.string().email().optional(),
    fullName: z.string().min(2).max(120).optional(),
    code: z.string().min(4).max(8),
    role: z.enum(["student", "instructor", "admin"]).optional()
  })
  .refine(
    (v) => {
      if (v.method === "phone-otp") return !!v.phone;
      if (v.method === "email-otp") return !!v.email;
      return true;
    },
    { message: "Phone or email is required for the selected method.", path: ["phone"] }
  );

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { method, phone, email, fullName, code, role } = parsed.data;
  const isLocalDev =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost") === true;

  try {
    let userId: string | null = null;
    let userEmail: string | null = email ?? null;
    let userPhone: string | null = phone ?? null;
    let sessionToken: string | null = null;
    let finalRole: "student" | "instructor" | "admin" = role ?? "student";

    if (isLocalDev) {
      // In local dev, accept the demo OTP "123456"
      if (code !== "123456" && code !== "654321") {
        return NextResponse.json({ ok: false, error: "Invalid OTP code." }, { status: 401 });
      }
      userId = `demo-${Date.now()}`;
      sessionToken = `demo-session-${Date.now()}`;
    } else {
      const authClient = createAnonServerSupabaseClient();
      if (method === "phone-otp" && phone) {
        const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/^0/, "")}`;
        const { data, error } = await authClient.auth.verifyOtp({
          phone: normalizedPhone,
          token: code,
          type: "sms"
        });
        if (error?.message.toLowerCase().includes("fetch failed")) {
          return NextResponse.json(
            { ok: false, error: "Cannot reach Supabase Auth. Check the Supabase project URL and project availability." },
            { status: 503 }
          );
        }
        if (error || !data.session) {
          return NextResponse.json({ ok: false, error: "Invalid or expired OTP." }, { status: 401 });
        }
        userId = data.session.user.id;
        userPhone = data.session.user.phone ?? phone;
        userEmail = data.session.user.email ?? null;
        sessionToken = data.session.access_token;
      } else if (method === "email-otp" && email) {
        const { data, error } = await authClient.auth.verifyOtp({
          email,
          token: code,
          type: "email"
        });
        if (error?.message.toLowerCase().includes("fetch failed")) {
          return NextResponse.json(
            { ok: false, error: "Cannot reach Supabase Auth. Check the Supabase project URL and project availability." },
            { status: 503 }
          );
        }
        if (error || !data.session) {
          return NextResponse.json({ ok: false, error: "Invalid or expired OTP." }, { status: 401 });
        }
        userId = data.session.user.id;
        userEmail = email;
        sessionToken = data.session.access_token;
      } else {
        return NextResponse.json({ ok: false, error: "Unsupported method." }, { status: 400 });
      }

      // Upsert profile
      const supabase = createServerSupabaseClient();
      const { data: existingProfile, error: profileLookupError } = await supabase
        .from("profiles")
        .select("id, role, email")
        .eq("id", userId!)
        .single();
      if (profileLookupError && profileLookupError.code !== "PGRST116") throw profileLookupError;

      if (!userEmail && existingProfile?.email) userEmail = existingProfile.email;

      const chosenRole = role ?? "student";
      finalRole = existingProfile?.role ?? chosenRole;

      if (!existingProfile) {
        // First login — create profile and start trial
        const { error: profileInsertError } = await supabase.from("profiles").insert({
          id: userId!,
          email: userEmail,
          phone: userPhone,
          full_name: fullName ?? null,
          role: chosenRole,
          trial_starts_at: new Date().toISOString(),
          trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          free_course_count: 0
        });
        if (profileInsertError) throw profileInsertError;

        // Create trial subscription record
        const { data: trialPlan } = await supabase
          .from("plans")
          .select("id")
          .eq("key", "trial")
          .single();

        if (trialPlan) {
          await supabase.from("subscriptions").insert({
            user_id: userId!,
            plan_id: trialPlan.id,
            status: "trial",
            starts_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
        }

        // Create instructor profile if needed
        if (chosenRole === "instructor") {
          const { error: instructorProfileError } = await supabase.from("instructor_profiles").insert({
            user_id: userId!,
            bio: null,
            headline: null,
            verified_badge: false
          });
          if (instructorProfileError) throw instructorProfileError;
        }
      }
    }

    if ((role === "admin" || finalRole === "admin") && process.env.NODE_ENV === "production") {
      const allowedAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!allowedAdminEmail || userEmail?.trim().toLowerCase() !== allowedAdminEmail) {
        return NextResponse.json({ ok: false, error: "Admin access is restricted." }, { status: 403 });
      }
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        id: userId,
        role: finalRole,
        email: userEmail ?? "user@learnhub.in",
        phone: userPhone ?? "",
        fullName: fullName ?? null
      }
    });

    // Set session cookies (httpOnly for security)
    response.cookies.set("learnhub_role", finalRole, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });
    response.cookies.set("learnhub_session", sessionToken ?? `session_${Date.now()}`, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30
    });

    return response;
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : "";
    const networkFailure = details.toLowerCase().includes("fetch failed");
    const configurationFailure =
      details.startsWith("Supabase configuration missing:") ||
      details.startsWith("NEXT_PUBLIC_SUPABASE_URL");
    const message = networkFailure
      ? "Cannot reach Supabase. Check the project URL, credentials, and project availability."
      : details || "Authentication failed.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: networkFailure || configurationFailure ? 503 : 500 }
    );
  }
}
