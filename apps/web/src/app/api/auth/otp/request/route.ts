import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase";


const requestSchema = z
  .object({
    method: z.enum(["phone-otp", "email-otp", "google"]),
    phone: z.string().min(10).max(25).optional(),
    email: z.string().email().optional(),
    fullName: z.string().min(2).max(120).optional()
  })
  .refine(
    (v) => {
      if (v.method === "phone-otp") return !!v.phone;
      if (v.method === "email-otp") return !!v.email;
      if (v.method === "google") return !!v.email || !!v.fullName;
      return true;
    },
    { message: "Phone or email is required for the selected method.", path: ["phone"] }
  );

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 }
    );
  }

  const { method, phone, email } = parsed.data;
  const supabase = createServerSupabaseClient();

  try {
    if (method === "phone-otp" && phone) {
      // Supabase phone OTP (or fallback to MSG91 via messaging helper)
      const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone.replace(/^0/, "")}`;

      if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")) {
        // Local dev: use messaging helper which returns demo code
        // Local demo OTP is returned in the response.
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
        if (error) throw error;
      }

      return NextResponse.json({
        ok: true,
        status: "otp_sent",
        method,
        deliveryTarget: normalizedPhone,
        ...(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost") ? { demoOtp: "123456" } : {}),
        expiresInSeconds: 300
      });
    }

    if (method === "email-otp" && email) {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")) {
        // Local demo OTP is returned in the response.
      } else {
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) throw error;
      }

      return NextResponse.json({
        ok: true,
        status: "otp_sent",
        method,
        deliveryTarget: email,
        ...(process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost") ? { demoOtp: "123456" } : {}),
        expiresInSeconds: 300
      });
    }

    if (method === "google") {
      // Google OAuth is handled entirely client-side via supabase.auth.signInWithOAuth
      // This endpoint just acknowledges the intent.
      return NextResponse.json({ ok: true, status: "google_redirect", method });
    }

    return NextResponse.json({ ok: false, error: "Unsupported method." }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send OTP.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
