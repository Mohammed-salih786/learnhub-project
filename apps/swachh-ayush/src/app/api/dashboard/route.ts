import { NextResponse } from "next/server";
import { type NextRequest } from "next/server";

import { getSwachhUser } from "@/lib/auth";
import { createDatabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getSwachhUser(request);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required." },
        { status: 401 },
      );
    }
    if (!user.role) {
      return NextResponse.json(
        {
          ok: false,
          error: "No active municipal role is assigned to this account.",
        },
        { status: 403 },
      );
    }

    const db = createDatabaseClient();
    const [
      wardsResult,
      vehiclesResult,
      stopsResult,
      risksResult,
      actionsResult,
      stopTotals,
      collectedTotal,
      missedTotal,
      criticalTotal,
      actionsTotal,
    ] = await Promise.all([
      db
        .from("swachh_wards")
        .select("id, city_name, ward_code, name, population")
        .order("ward_code"),
      db
        .from("swachh_vehicles")
        .select("id, vehicle_code, capacity_kg")
        .eq("active", true)
        .order("vehicle_code"),
      db
        .from("swachh_route_stops")
        .select(
          "id, status, planned_at, recorded_at, street:swachh_streets!street_id(name, ward:swachh_wards!ward_id(name, ward_code))",
        )
        .order("planned_at", { ascending: false })
        .limit(100),
      db
        .from("swachh_risk_assessments")
        .select(
          "id, risk_score, severity, correlation_confidence, assessed_at, street:swachh_streets!street_id(name, ward:swachh_wards!ward_id(name, ward_code))",
        )
        .order("assessed_at", { ascending: false })
        .limit(50),
      db
        .from("swachh_preventive_actions")
        .select(
          "id, action_type, status, scheduled_at, created_at, assessment:swachh_risk_assessments!risk_assessment_id(street:swachh_streets!street_id(name, ward:swachh_wards!ward_id(name, ward_code)))",
        )
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_at")
        .limit(50),
      db
        .from("swachh_route_stops")
        .select("id", { count: "exact", head: true }),
      db
        .from("swachh_route_stops")
        .select("id", { count: "exact", head: true })
        .eq("status", "collected"),
      db
        .from("swachh_route_stops")
        .select("id", { count: "exact", head: true })
        .in("status", ["skipped", "blocked"]),
      db
        .from("swachh_risk_assessments")
        .select("id", { count: "exact", head: true })
        .eq("severity", "critical"),
      db
        .from("swachh_preventive_actions")
        .select("id", { count: "exact", head: true })
        .in("status", ["scheduled", "in_progress"]),
    ]);

    for (const result of [
      wardsResult,
      vehiclesResult,
      stopsResult,
      risksResult,
      actionsResult,
      stopTotals,
      collectedTotal,
      missedTotal,
      criticalTotal,
      actionsTotal,
    ]) {
      if (result.error) throw result.error;
    }

    const wards = wardsResult.data ?? [];
    const stops = stopsResult.data ?? [];
    const riskZones = risksResult.data ?? [];
    const actions = actionsResult.data ?? [];
    const totalStops = stopTotals.count ?? 0;
    const collectedStops = collectedTotal.count ?? 0;

    return NextResponse.json({
      ok: true,
      city: wards[0]?.city_name ?? "Pilot city",
      role: user.role,
      summary: {
        wards: wards.length,
        routeStops: totalStops,
        routeCompliancePercent:
          totalStops > 0 ? Math.round((collectedStops / totalStops) * 100) : 0,
        missedStreets: missedTotal.count ?? 0,
        criticalZones: criticalTotal.count ?? 0,
        activeActions: actionsTotal.count ?? 0,
      },
      wards,
      vehicles: vehiclesResult.data ?? [],
      routeStops: stops,
      riskZones,
      actions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load Swachh-Ayush dashboard:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Dashboard data is unavailable. Check the database connection.",
      },
      { status: 503 },
    );
  }
}
