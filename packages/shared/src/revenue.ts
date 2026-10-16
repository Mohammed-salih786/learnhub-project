/**
 * Revenue share estimation logic.
 * Instructor earnings = (instructor watch-minutes / total platform watch-minutes) × revenue pool × share percent
 * This is an ESTIMATE, clearly labelled as such. Actual payouts are manual (admin CSV export).
 */

export interface RevenueShareInput {
  instructorWatchMinutes: number;
  totalPlatformWatchMinutes: number;
  /** Total platform revenue in paise (₹1 = 100 paise) during the period */
  totalRevenuePaise: number;
  /** Instructor share as a decimal, e.g. 0.70 for 70% */
  instructorSharePercent: number;
}

export interface RevenueShareResult {
  estimatedEarningsPaise: number;
  estimatedEarningsFormatted: string;
  sharePercent: number;
  watchMinuteContribution: number; // 0–1 fraction
  isEstimate: true;
  disclaimer: string;
}

export function estimateInstructorEarnings(input: RevenueShareInput): RevenueShareResult {
  const {
    instructorWatchMinutes,
    totalPlatformWatchMinutes,
    totalRevenuePaise,
    instructorSharePercent
  } = input;

  if (
    totalPlatformWatchMinutes <= 0 ||
    instructorWatchMinutes < 0 ||
    instructorSharePercent <= 0 ||
    instructorSharePercent > 1
  ) {
    return {
      estimatedEarningsPaise: 0,
      estimatedEarningsFormatted: "₹0",
      sharePercent: instructorSharePercent,
      watchMinuteContribution: 0,
      isEstimate: true,
      disclaimer:
        "Earnings are an estimate based on your share of total watch-minutes. Actual payouts are processed manually by the admin team."
    };
  }

  const contribution = instructorWatchMinutes / totalPlatformWatchMinutes;
  const revenuePool = totalRevenuePaise * instructorSharePercent;
  const earningsPaise = Math.floor(contribution * revenuePool);

  return {
    estimatedEarningsPaise: earningsPaise,
    estimatedEarningsFormatted: formatPaise(earningsPaise),
    sharePercent: instructorSharePercent,
    watchMinuteContribution: contribution,
    isEstimate: true,
    disclaimer:
      "Earnings are an estimate based on your share of total watch-minutes. Actual payouts are processed manually by the admin team."
  };
}

export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(rupees);
}
