export interface RouteStreet {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  estimated_waste_kg: number;
  collection_window_start: string | null;
}

export interface PlannedStop extends RouteStreet {
  sequenceNumber: number;
  distanceFromPreviousKm: number;
  plannedAt: string;
}

export function distanceInKm(
  from: Pick<RouteStreet, "latitude" | "longitude">,
  to: Pick<RouteStreet, "latitude" | "longitude">,
) {
  if (
    from.latitude === null ||
    from.longitude === null ||
    to.latitude === null ||
    to.longitude === null
  ) {
    throw new Error(
      "Every street must have coordinates before route planning.",
    );
  }

  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDistance = radians(to.latitude - from.latitude);
  const longitudeDistance = radians(to.longitude - from.longitude);
  const value =
    Math.sin(latitudeDistance / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDistance / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function optimizeWardRoute(
  streets: RouteStreet[],
  serviceDate: string,
  vehicleCapacityKg: number,
): PlannedStop[] {
  if (streets.length === 0)
    throw new Error("The selected ward has no streets to route.");
  if (
    streets.some(
      (street) => street.latitude === null || street.longitude === null,
    )
  ) {
    throw new Error(
      "Every street must have coordinates before route planning.",
    );
  }

  const estimatedWaste = streets.reduce(
    (total, street) => total + street.estimated_waste_kg,
    0,
  );
  if (estimatedWaste > vehicleCapacityKg) {
    throw new Error(
      `Estimated waste (${estimatedWaste} kg) exceeds vehicle capacity (${vehicleCapacityKg} kg).`,
    );
  }

  const remaining = [...streets].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
  const ordered = [remaining.shift()!];
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let shortestDistance = distanceInKm(current, remaining[0]);
    for (let index = 1; index < remaining.length; index += 1) {
      const candidateDistance = distanceInKm(current, remaining[index]);
      if (candidateDistance < shortestDistance) {
        nearestIndex = index;
        shortestDistance = candidateDistance;
      }
    }
    ordered.push(remaining.splice(nearestIndex, 1)[0]);
  }

  let elapsedMinutes = 0;
  return ordered.map((street, index) => {
    const previous = index > 0 ? ordered[index - 1] : null;
    const distanceFromPreviousKm = previous
      ? distanceInKm(previous, street)
      : 0;
    elapsedMinutes +=
      distanceFromPreviousKm > 0 ? (distanceFromPreviousKm / 20) * 60 : 0;
    const [hour = "06", minute = "00"] =
      street.collection_window_start?.split(":") ?? [];
    const windowStartMinutes = Number(hour) * 60 + Number(minute.slice(0, 2));
    const scheduledMinutes = Math.max(
      windowStartMinutes,
      6 * 60 + Math.round(elapsedMinutes),
    );
    const plannedAt = new Date(`${serviceDate}T06:00:00+05:30`);
    plannedAt.setUTCMinutes(
      plannedAt.getUTCMinutes() + scheduledMinutes - 6 * 60,
    );
    elapsedMinutes = scheduledMinutes - 6 * 60 + 10;
    return {
      ...street,
      sequenceNumber: index + 1,
      distanceFromPreviousKm: Number(distanceFromPreviousKm.toFixed(2)),
      plannedAt: plannedAt.toISOString(),
    };
  });
}
