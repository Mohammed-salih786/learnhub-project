import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorizedIngestRequest } from "@/lib/ingest-auth";
import { assessSkippedStop } from "@/lib/risk-engine";
import { createDatabaseClient } from "@/lib/supabase";

const collectionSchema = z.object({
  routeStopId: z.string().uuid(),
  status: z.enum(["collected", "skipped", "blocked"]),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  reason: z.string().max(240).optional(),
  recordedAt: z.string().datetime().optional(),
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
      { ok: false, error: "Unauthorized telemetry request." },
      { status: 401 },
    );
  }

  const parsed = collectionSchema.safeParse(
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
    const { routeStopId, status, latitude, longitude, reason, recordedAt } =
      parsed.data;
    const { data: stop, error } = await db
      .from("swachh_route_stops")
      .update({
        status,
        recorded_at: recordedAt ?? new Date().toISOString(),
        gps_latitude: latitude ?? null,
        gps_longitude: longitude ?? null,
        skip_reason: reason ?? null,
      })
      .eq("id", routeStopId)
      .select("id")
      .single();
    if (error) throw error;

    const riskResult =
      status === "skipped" || status === "blocked"
        ? await assessSkippedStop(db, routeStopId)
        : null;

    return NextResponse.json({
      ok: true,
      routeStopId: stop.id,
      status,
      risk: riskResult?.assessment ?? null,
      actionsScheduled: riskResult?.actions.length ?? 0,
    });
  } catch (error) {
    console.error("Failed to process collection telemetry:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not save the collection report. Verify the route stop and database.",
      },
      { status: 500 },
    );
  }
}
