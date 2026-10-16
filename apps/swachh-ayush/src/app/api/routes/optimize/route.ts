import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSwachhUser } from "@/lib/auth";
import { optimizeWardRoute } from "@/lib/route-optimizer";
import { createDatabaseClient } from "@/lib/supabase";

const routeRequestSchema = z.object({
  wardId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  serviceDate: z.string().date(),
});

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await getSwachhUser(request);
  } catch (error) {
    console.error("Failed to authenticate route planner:", error);
    return NextResponse.json(
      { ok: false, error: "Authentication service is unavailable." },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  if (
    !user.role ||
    !["city_commissioner", "waste_manager", "supervisor"].includes(user.role)
  ) {
    return NextResponse.json(
      { ok: false, error: "Your municipal role cannot assign routes." },
      { status: 403 },
    );
  }

  const parsed = routeRequestSchema.safeParse(
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
    const { wardId, vehicleId, serviceDate } = parsed.data;
    const [streetsResult, vehicleResult] = await Promise.all([
      db
        .from("swachh_streets")
        .select(
          "id, name, latitude, longitude, estimated_waste_kg, collection_window_start",
        )
        .eq("ward_id", wardId)
        .order("name")
        .limit(1000),
      db
        .from("swachh_vehicles")
        .select("id, capacity_kg")
        .eq("id", vehicleId)
        .eq("active", true)
        .maybeSingle(),
    ]);
    if (streetsResult.error) throw streetsResult.error;
    if (vehicleResult.error) throw vehicleResult.error;
    const streets = streetsResult.data ?? [];
    const vehicle = vehicleResult.data;

    if (!vehicle) {
      return NextResponse.json(
        { ok: false, error: "Active vehicle not found." },
        { status: 404 },
      );
    }
    if (streets.length === 0) {
      return NextResponse.json(
        { ok: false, error: "The selected ward has no mapped streets." },
        { status: 404 },
      );
    }
    if (
      streets.some(
        (street) => street.latitude === null || street.longitude === null,
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Every street must have coordinates before route planning.",
        },
        { status: 422 },
      );
    }

    const estimatedWasteKg = streets.reduce(
      (total, street) => total + Number(street.estimated_waste_kg),
      0,
    );
    if (estimatedWasteKg > vehicle.capacity_kg) {
      return NextResponse.json(
        {
          ok: false,
          error: `Estimated waste (${estimatedWasteKg} kg) exceeds vehicle capacity (${vehicle.capacity_kg} kg).`,
        },
        { status: 422 },
      );
    }

    const stops = optimizeWardRoute(streets, serviceDate, vehicle.capacity_kg);
    const { data: routeRun, error: runError } = await db
      .from("swachh_route_runs")
      .insert({
        vehicle_id: vehicleId,
        service_date: serviceDate,
        status: "planned",
      })
      .select("id")
      .single();
    if (runError) {
      if (runError.code === "23505") {
        return NextResponse.json(
          {
            ok: false,
            error: "This vehicle already has a route for that service date.",
          },
          { status: 409 },
        );
      }
      throw runError;
    }

    const { error: stopsError } = await db.from("swachh_route_stops").insert(
      stops.map((stop) => ({
        route_run_id: routeRun.id,
        street_id: stop.id,
        sequence_number: stop.sequenceNumber,
        planned_at: stop.plannedAt,
        status: "scheduled",
      })),
    );
    if (stopsError) {
      const { error: rollbackError } = await db
        .from("swachh_route_runs")
        .delete()
        .eq("id", routeRun.id);
      if (rollbackError)
        console.error("Failed to roll back incomplete route:", rollbackError);
      throw stopsError;
    }

    return NextResponse.json(
      {
        ok: true,
        routeRunId: routeRun.id,
        serviceDate,
        vehicleId,
        estimatedWasteKg,
        totalDistanceKm: Number(
          stops
            .reduce((total, stop) => total + stop.distanceFromPreviousKm, 0)
            .toFixed(2),
        ),
        stops: stops.map(
          ({
            id,
            name,
            sequenceNumber,
            plannedAt,
            distanceFromPreviousKm,
          }) => ({
            streetId: id,
            street: name,
            sequenceNumber,
            plannedAt,
            distanceFromPreviousKm,
          }),
        ),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to optimize municipal route:", error);
    return NextResponse.json(
      { ok: false, error: "Could not optimize or save the route." },
      { status: 500 },
    );
  }
}
