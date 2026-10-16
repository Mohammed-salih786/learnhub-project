/**
 * Messaging abstraction: SMS OTP via MSG91 (DLT-compliant) and transactional
 * email via Resend. Falls back gracefully in local dev.
 *
 * Rules:
 * - OTP generation/verification is handled server-side only.
 * - Secrets never leave the server.
 */

import { Resend } from "resend";

// ---------------------------------------------------------------------------
// Email via Resend
// ---------------------------------------------------------------------------

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith("re_xxx")) return null;
  return new Resend(key);
}

export async function sendEmailOtp(email: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    // Local dev — log OTP to console only (demo code "123456")
    console.info(`[DEV] Email OTP for ${email}: 123456`);
    return;
  }

  // In production, Supabase handles OTP emails automatically.
  // This helper is for custom transactional emails.
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "hello@learnhub.in",
    to: email,
    subject: "Your LearnHub login code",
    html: `<p>Your one-time login code is: <strong>{{OTP}}</strong></p><p>This code expires in 5 minutes.</p>`
  });
}

export async function sendRenewalReminder(
  email: string,
  name: string,
  renewalDate: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.info(`[DEV] Renewal reminder for ${email} on ${renewalDate}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "hello@learnhub.in",
    to: email,
    subject: "Your LearnHub subscription renews in 3 days",
    html: `
      <h2>Hi ${name},</h2>
      <p>Your LearnHub subscription will renew on <strong>${renewalDate}</strong>.</p>
      <p>To keep uninterrupted access, please ensure your payment method is up to date.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/student/billing">Manage billing</a></p>
    `
  });
}

export async function sendPaymentFailedEmail(email: string, name: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.info(`[DEV] Payment failed email for ${email}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "hello@learnhub.in",
    to: email,
    subject: "Action required: LearnHub payment failed",
    html: `
      <h2>Hi ${name},</h2>
      <p>We were unable to process your subscription payment. You have a <strong>3-day grace period</strong> to update your payment details before access is paused.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/student/billing">Update payment method</a></p>
    `
  });
}

export async function sendCertificateEmail(
  email: string,
  name: string,
  courseTitle: string,
  certificateUrl: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.info(`[DEV] Certificate email for ${email}: ${certificateUrl}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "hello@learnhub.in",
    to: email,
    subject: `Your certificate for "${courseTitle}" is ready`,
    html: `
      <h2>Congratulations, ${name}!</h2>
      <p>You've successfully completed <strong>${courseTitle}</strong> on LearnHub.</p>
      <p><a href="${certificateUrl}">Download your certificate</a></p>
    `
  });
}

export async function sendNewCourseFromFollowedInstructor(
  email: string,
  name: string,
  instructorName: string,
  courseTitle: string,
  courseSlug: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.info(`[DEV] New course notification for ${email}`);
    return;
  }

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "hello@learnhub.in",
    to: email,
    subject: `${instructorName} just published a new course`,
    html: `
      <h2>Hi ${name},</h2>
      <p><strong>${instructorName}</strong>, an instructor you follow, just published a new course:</p>
      <h3>${courseTitle}</h3>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/courses/${courseSlug}">View course</a></p>
    `
  });
}

// ---------------------------------------------------------------------------
// SMS via MSG91 (DLT-compliant, India)
// ---------------------------------------------------------------------------

const MSG91_BASE = "https://api.msg91.com/api/v5";

export async function sendSmsOtp(phone: string): Promise<void> {
  const apiKey = process.env.MSG91_API_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

  if (!apiKey || apiKey.startsWith("your-")) {
    console.info(`[DEV] SMS OTP for ${phone}: 123456`);
    return;
  }

  const response = await fetch(`${MSG91_BASE}/otp?template_id=${templateId}&mobile=${encodeURIComponent(phone)}`, {
    method: "POST",
    headers: {
      "authkey": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ mobile: phone })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MSG91 OTP send failed: ${body}`);
  }
}

export async function verifySmsOtp(phone: string, otp: string): Promise<boolean> {
  const apiKey = process.env.MSG91_API_KEY;

  if (!apiKey || apiKey.startsWith("your-")) {
    // Local dev: accept demo OTP
    return otp === "123456";
  }

  const response = await fetch(
    `${MSG91_BASE}/otp/verify?mobile=${encodeURIComponent(phone)}&otp=${otp}`,
    {
      method: "GET",
      headers: { "authkey": apiKey }
    }
  );

  const data = await response.json().catch(() => ({}));
  return data.type === "success";
}
