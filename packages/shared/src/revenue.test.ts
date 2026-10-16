import { describe, expect, it } from "vitest";

import { estimateInstructorEarnings } from "./revenue";

describe("estimateInstructorEarnings", () => {
  it("correctly calculates share when instructor accounts for 50% of watch minutes", () => {
    const result = estimateInstructorEarnings({
      instructorWatchMinutes: 500,
      totalPlatformWatchMinutes: 1000,
      totalRevenuePaise: 100_000_00, // ₹1,00,000
      instructorSharePercent: 0.7    // 70% pool goes to instructors
    });

    // Expected: 0.5 contribution × 70_000_00 pool = 35_000_00 (₹35,000)
    expect(result.estimatedEarningsPaise).toBe(35_000_00);
    expect(result.watchMinuteContribution).toBe(0.5);
    expect(result.isEstimate).toBe(true);
  });

  it("returns zero when there are no platform watch minutes", () => {
    const result = estimateInstructorEarnings({
      instructorWatchMinutes: 100,
      totalPlatformWatchMinutes: 0,
      totalRevenuePaise: 10000,
      instructorSharePercent: 0.7
    });

    expect(result.estimatedEarningsPaise).toBe(0);
  });

  it("returns zero when instructor has no watch minutes", () => {
    const result = estimateInstructorEarnings({
      instructorWatchMinutes: 0,
      totalPlatformWatchMinutes: 1000,
      totalRevenuePaise: 10000,
      instructorSharePercent: 0.7
    });

    expect(result.estimatedEarningsPaise).toBe(0);
  });
});
