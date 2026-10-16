import { NextRequest, NextResponse } from "next/server";

import { checkCertificateEligibility } from "@learnhub/shared";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getUserEntitlementContext } from "@/lib/db";
import { generateCertificatePdf } from "@/lib/certificate";
import { sendCertificateEmail } from "@/lib/messaging";

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const userId = request.cookies.get("learnhub_session")?.value;
  const isLocalDev = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost");

  if (!userId && !isLocalDev) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const db = createServerSupabaseClient();

  // Check if certificate already exists
  const { data: existing } = await db
    .from("certificates")
    .select("id, certificate_url, generated_at")
    .eq("user_id", userId!)
    .eq("course_id", params.courseId)
    .single();

  if (existing) {
    return NextResponse.json({
      ok: true,
      certificate: existing,
      message: "Certificate already generated."
    });
  }

  if (!isLocalDev) {
    // Check entitlement
    const entitlement = await getUserEntitlementContext(userId!);
    if (!entitlement) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    // Compute course completion
    const { data: lessons } = await db
      .from("lessons")
      .select("id")
      .eq("course_id", params.courseId);

    const { data: progress } = await db
      .from("lesson_progress")
      .select("percent_complete")
      .eq("user_id", userId!)
      .in("lesson_id", (lessons ?? []).map((l) => l.id));

    const avgCompletion =
      lessons && lessons.length > 0
        ? Math.round(
            (progress ?? []).reduce((s, p) => s + (p.percent_complete ?? 0), 0) /
              lessons.length
          )
        : 0;

    const eligibility = checkCertificateEligibility({
      planKey: (entitlement.planKey as "trial" | "monthly" | "yearly") ?? "monthly",
      courseCompletionPercent: avgCompletion,
      subscriptionStatus: entitlement.hasActiveSubscription ? "active" : entitlement.hasActiveTrial ? "trial" : "expired"
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        { ok: false, error: eligibility.reason, completionPercent: avgCompletion },
        { status: 403 }
      );
    }
  }

  // Get course and profile details for certificate
  const [courseRes, profileRes] = await Promise.all([
    db.from("courses").select("title").eq("id", params.courseId).single(),
    userId ? db.from("profiles").select("full_name, email").eq("id", userId).single() : Promise.resolve({ data: null })
  ]);

  const courseTitle = courseRes.data?.title ?? "Course";
  const studentName = profileRes.data?.full_name ?? "Student";

  // Generate PDF
  const certId = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const pdfBytes = await generateCertificatePdf({
    certId,
    studentName,
    courseTitle,
    issuedAt: new Date().toISOString()
  });

  // Upload to Supabase Storage
  let certificateUrl = `/api/student/certificate/${params.courseId}/download`;

  if (!isLocalDev) {
    const { data: upload, error: uploadError } = await db.storage
      .from("certificates")
      .upload(`${userId}/${params.courseId}/certificate.pdf`, pdfBytes, {
        contentType: "application/pdf",
        upsert: true
      });

    if (!uploadError && upload) {
      const { data: urlData } = db.storage
        .from("certificates")
        .getPublicUrl(`${userId}/${params.courseId}/certificate.pdf`);
      certificateUrl = urlData.publicUrl;
    }
  }

  // Save certificate record
  const { data: cert, error: certError } = await db
    .from("certificates")
    .insert({
      user_id: userId!,
      course_id: params.courseId,
      certificate_url: certificateUrl,
      generated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (certError) {
    return NextResponse.json({ ok: false, error: certError.message }, { status: 500 });
  }

  // Send certificate email (non-blocking)
  if (profileRes.data?.email) {
    sendCertificateEmail(
      profileRes.data.email,
      studentName,
      courseTitle,
      certificateUrl
    ).catch((e) => console.error("Certificate email failed:", e));
  }

  return NextResponse.json({
    ok: true,
    certificate: cert,
    message: "Certificate generated successfully!"
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  // Public verification endpoint — returns certificate metadata by courseId
  const db = createServerSupabaseClient();
  const { data, error } = await db
    .from("certificates")
    .select(`
      id, certificate_url, generated_at,
      user:profiles!user_id(full_name),
      course:courses!course_id(title)
    `)
    .eq("course_id", params.courseId)
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, error: "Certificate not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, certificate: data });
}
