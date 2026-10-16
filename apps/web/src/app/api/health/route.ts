import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createServerSupabaseClient();
    const { error } = await db.from("plans").select("id").limit(1);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      service: "LearnHub",
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV ?? "development",
    });
  } catch (error) {
    console.error("Health check database query failed:", error);

    return NextResponse.json(
      {
        ok: false,
        service: "LearnHub",
        status: "unavailable",
        database: "disconnected",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV ?? "development",
      },
      { status: 503 },
    );
  }
}
