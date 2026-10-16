import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedIngestRequest } from "@/lib/ingest-auth";
import { createDatabaseClient } from "@/lib/supabase";

const weatherSchema = z.object({
  wardId: z.string().uuid(),
  rainfallMm: z.number().nonnegative(),
  humidityPercent: z.number().min(0).max(100),
  source: z.string().trim().min(1).max(80),
  observedAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  if (!process.env.SWACHH_INGEST_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "SWACHH_INGEST_API_KEY is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorizedIngestRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized weather-data request." },
      { status: 401 },
    );
  }

  const parsed = weatherSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues.map((issue) => issue.message).join(", "),
      },
      { status: 400 },
    );
  }

  try {
    const db = createDatabaseClient();
    const { data, error } = await db
      .from("swachh_weather_observations")
      .insert({
        ward_id: parsed.data.wardId,
        rainfall_mm: parsed.data.rainfallMm,
        humidity_percent: parsed.data.humidityPercent,
        source: parsed.data.source,
        observed_at: parsed.data.observedAt ?? new Date().toISOString(),
      })
      .select("id, ward_id, observed_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ ok: true, observation: data }, { status: 201 });
  } catch (error) {
    console.error("Failed to save weather observation:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not save the weather observation. Verify the ward and database.",
      },
      { status: 500 },
    );
  }
}
