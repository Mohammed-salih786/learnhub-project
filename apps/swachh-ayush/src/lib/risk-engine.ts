import type { createDatabaseClient } from "./supabase";
import { calculateRisk } from "./risk";

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export async function assessSkippedStop(db: DatabaseClient, stopId: string) {
  const { data: stop, error: stopError } = await db
    .from("swachh_route_stops")
    .select("id, street_id")
    .eq("id", stopId)
    .single();
  if (stopError) throw stopError;

  const { data: street, error: streetError } = await db
    .from("swachh_streets")
    .select("ward_id")
    .eq("id", stop.street_id)
    .single();
  if (streetError) throw streetError;

  const { data: ward, error: wardError } = await db
    .from("swachh_wards")
    .select("id, population")
    .eq("id", street.ward_id)
    .single();
  if (wardError) throw wardError;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [missesResult, signalsResult, weatherResult] = await Promise.all([
    db
      .from("swachh_route_stops")
      .select("id", { count: "exact", head: true })
      .eq("street_id", stop.street_id)
      .in("status", ["skipped", "blocked"])
      .gte("recorded_at", since),
    db
      .from("swachh_health_signals")
      .select("fever_cases, observed_on")
      .eq("ward_id", ward.id)
      .order("observed_on", { ascending: false })
      .limit(8),
    db
      .from("swachh_weather_observations")
      .select("rainfall_mm, humidity_percent")
      .eq("ward_id", ward.id)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (missesResult.error) throw missesResult.error;
  if (signalsResult.error) throw signalsResult.error;
  if (weatherResult.error) throw weatherResult.error;

  const signals = signalsResult.data ?? [];
  const recentFeverCases = signals[0]?.fever_cases ?? 0;
  const previousSignals = signals.slice(1);
  const baselineFeverCases =
    previousSignals.length > 0
      ? previousSignals.reduce((sum, signal) => sum + signal.fever_cases, 0) /
        previousSignals.length
      : 0;
  const risk = calculateRisk({
    missedStopsLast30Days: missesResult.count ?? 1,
    rainfallMm: Number(weatherResult.data?.rainfall_mm ?? 0),
    humidityPercent: Number(weatherResult.data?.humidity_percent ?? 0),
    population: ward.population,
    recentFeverCases,
    baselineFeverCases,
    healthReports: signals.length,
  });

  const { data: assessment, error: assessmentError } = await db
    .from("swachh_risk_assessments")
    .upsert(
      {
        ward_id: ward.id,
        street_id: stop.street_id,
        route_stop_id: stopId,
        risk_score: risk.riskScore,
        severity: risk.severity,
        correlation_confidence: risk.correlationConfidence,
        factors: risk.factors,
        assessed_at: new Date().toISOString(),
      },
      { onConflict: "route_stop_id" },
    )
    .select("id, risk_score, severity, correlation_confidence, factors")
    .single();
  if (assessmentError) throw assessmentError;

  let actions: Array<{ action_type: string }> = [];
  if (risk.severity === "critical" && risk.correlationConfidence >= 0.6) {
    const scheduledAt = new Date(
      Date.now() + 12 * 60 * 60 * 1000,
    ).toISOString();
    const actionTypes = [
      "waste_collection",
      "fogging",
      "supervisor_notification",
    ] as const;
    const { data, error } = await db
      .from("swachh_preventive_actions")
      .upsert(
        actionTypes.map((actionType) => ({
          risk_assessment_id: assessment.id,
          action_type: actionType,
          scheduled_at: scheduledAt,
          idempotency_key: `${stopId}:${actionType}`,
          details: { triggeredBy: "critical-risk-assessment" },
        })),
        { onConflict: "idempotency_key", ignoreDuplicates: true },
      )
      .select("action_type");
    if (error) throw error;
    actions = data ?? [];
  }

  return { assessment, actions };
}
