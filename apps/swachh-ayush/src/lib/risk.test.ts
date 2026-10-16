import { describe, expect, it } from "vitest";

import { calculateRisk } from "./risk";

describe("calculateRisk", () => {
  it("returns low risk when there is no environmental or health signal", () => {
    expect(
      calculateRisk({
        missedStopsLast30Days: 1,
        rainfallMm: 0,
        humidityPercent: 0,
        population: 0,
        recentFeverCases: 0,
        baselineFeverCases: 0,
        healthReports: 0,
      }),
    ).toMatchObject({
      riskScore: 22,
      severity: "low",
      correlationConfidence: 0.3,
    });
  });

  it("caps risk at 100 and raises confidence for multi-day health data", () => {
    const result = calculateRisk({
      missedStopsLast30Days: 20,
      rainfallMm: 500,
      humidityPercent: 100,
      population: 100_000,
      recentFeverCases: 100,
      baselineFeverCases: 10,
      healthReports: 3,
    });

    expect(result.riskScore).toBe(100);
    expect(result.severity).toBe("critical");
    expect(result.correlationConfidence).toBe(0.8);
  });
});
