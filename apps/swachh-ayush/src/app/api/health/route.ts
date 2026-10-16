import { NextResponse } from "next/server";

import { createDatabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = createDatabaseClient();
    const { error } = await db.from("swachh_wards").select("id").limit(1);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      service: "Swachh-Ayush AI",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Swachh-Ayush health check failed:", error);
    return NextResponse.json(
      {
        ok: false,
        service: "Swachh-Ayush AI",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
