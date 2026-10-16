import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedIngestRequest } from "@/lib/ingest-auth";
import { assessSkippedStop } from "@/lib/risk-engine";
import { createDatabaseClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!process.env.SWACHH_INGEST_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "SWACHH_INGEST_API_KEY is not configured." },
      { status: 503 },
    );
  }
  if (!isAuthorizedIngestRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized operations request." },
      { status: 401 },
    );
  }

  try {
    const db = createDatabaseClient();
    const now = new Date().toISOString();
    const { data: overdueStops, error: selectError } = await db
      .from("swachh_route_stops")
      .select("id")
      .eq("status", "scheduled")
      .lt("planned_at", now)
      .limit(500);
    if (selectError) throw selectError;

    const overdueIds = (overdueStops ?? []).map((stop) => stop.id);
    if (overdueIds.length > 0) {
      const { error } = await db
        .from("swachh_route_stops")
        .update({
          status: "skipped",
          recorded_at: now,
          skip_reason: "Collection window elapsed without proof of service.",
        })
        .in("id", overdueIds);
      if (error) throw error;
    }

    const { data: unassessedStops, error: unassessedError } = await db
      .from("swachh_route_stops")
      .select("id, assessment:swachh_risk_assessments!route_stop_id(id)")
      .in("status", ["skipped", "blocked"])
      .limit(500);
    if (unassessedError) throw unassessedError;

    let assessmentsCreated = 0;
    for (const stop of unassessedStops ?? []) {
      const assessment = Array.isArray(stop.assessment)
        ? stop.assessment[0]
        : stop.assessment;
      if (assessment) continue;
      await assessSkippedStop(db, stop.id);
      assessmentsCreated += 1;
    }

    return NextResponse.json({
      ok: true,
      skippedStopsDetected: overdueIds.length,
      assessmentsCreated,
      scannedAt: now,
    });
  } catch (error) {
    console.error("Failed to scan overdue collection stops:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not scan overdue stops. Check the database and retry.",
      },
      { status: 500 },
    );
  }
}
