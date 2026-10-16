/**
 * Certificate eligibility logic.
 * Certificates are only available to Yearly plan subscribers who have completed a course.
 */

export interface CertificateEligibilityInput {
  planKey: "trial" | "monthly" | "yearly";
  courseCompletionPercent: number; // 0–100
  subscriptionStatus: "trial" | "active" | "cancelled" | "expired";
  completionThreshold?: number; // default 80
}

export interface CertificateEligibilityResult {
  eligible: boolean;
  reason: string;
}

export function checkCertificateEligibility(
  input: CertificateEligibilityInput
): CertificateEligibilityResult {
  const { planKey, courseCompletionPercent, subscriptionStatus, completionThreshold = 80 } = input;

  if (subscriptionStatus !== "active") {
    return { eligible: false, reason: "An active subscription is required to earn a certificate." };
  }

  if (planKey !== "yearly") {
    return {
      eligible: false,
      reason: "Certificates are available exclusively on the Yearly plan. Upgrade to earn certificates."
    };
  }

  if (courseCompletionPercent < completionThreshold) {
    return {
      eligible: false,
      reason: `You need to complete at least ${completionThreshold}% of the course to earn a certificate. You are at ${courseCompletionPercent}%.`
    };
  }

  return {
    eligible: true,
    reason: "You are eligible to receive a certificate for this course."
  };
}
