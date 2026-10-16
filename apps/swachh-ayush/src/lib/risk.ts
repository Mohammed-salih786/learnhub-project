export interface RiskInputs {
  missedStopsLast30Days: number;
  rainfallMm: number;
  humidityPercent: number;
  population: number;
  recentFeverCases: number;
  baselineFeverCases: number;
  healthReports: number;
}

export interface RiskResult {
  riskScore: number;
  severity: "low" | "medium" | "critical";
  correlationConfidence: number;
  factors: Record<string, number>;
}

export function calculateRisk(inputs: RiskInputs): RiskResult {
  const feverIncrease = inputs.recentFeverCases - inputs.baselineFeverCases;
  const factors = {
    missedCollection: Math.min(
      40,
      22 + Math.max(0, inputs.missedStopsLast30Days - 1) * 3,
    ),
    rainfall: Math.min(10, Math.max(0, inputs.rainfallMm) / 20),
    humidity: Math.min(10, Math.max(0, inputs.humidityPercent) / 10),
    population: Math.min(10, Math.max(0, inputs.population) / 10_000),
    feverTrend:
      inputs.baselineFeverCases > 0
        ? Math.min(
            30,
            Math.max(0, feverIncrease / inputs.baselineFeverCases) * 30,
          )
        : inputs.recentFeverCases > 0
          ? 8
          : 0,
  };
  const riskScore = Math.min(
    100,
    Math.round(
      Object.values(factors).reduce((total, factor) => total + factor, 0),
    ),
  );
  const correlationConfidence =
    inputs.healthReports >= 3 ? 0.8 : inputs.healthReports > 0 ? 0.6 : 0.3;

  return {
    riskScore,
    severity: riskScore >= 70 ? "critical" : riskScore >= 40 ? "medium" : "low",
    correlationConfidence,
    factors,
  };
}
