import { describe, expect, it } from "vitest";

import { optimizeWardRoute } from "./route-optimizer";

const streets = [
  {
    id: "second",
    name: "Second Street",
    latitude: 18.521,
    longitude: 73.857,
    estimated_waste_kg: 100,
    collection_window_start: "06:00:00",
  },
  {
    id: "first",
    name: "First Street",
    latitude: 18.52,
    longitude: 73.856,
    estimated_waste_kg: 150,
    collection_window_start: "06:00:00",
  },
];

describe("optimizeWardRoute", () => {
  it("orders stops by proximity and produces timed, sequenced stops", () => {
    const route = optimizeWardRoute(streets, "2026-10-15", 500);

    expect(route.map((stop) => stop.id)).toEqual(["first", "second"]);
    expect(route.map((stop) => stop.sequenceNumber)).toEqual([1, 2]);
    expect(route[0].distanceFromPreviousKm).toBe(0);
    expect(new Date(route[1].plannedAt).getTime()).toBeGreaterThan(
      new Date(route[0].plannedAt).getTime(),
    );
  });

  it("rejects routes that exceed vehicle capacity", () => {
    expect(() => optimizeWardRoute(streets, "2026-10-15", 200)).toThrow(
      /exceeds vehicle capacity/,
    );
  });
});
