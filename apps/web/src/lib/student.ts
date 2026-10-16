import { z } from "zod";

import { enrollmentStatusSchema } from "@learnhub/shared";

export function validateEnrollmentStatus(payload: unknown) {
  return enrollmentStatusSchema.parse(payload);
}

export const courseBrowseFilterSchema = z.object({
  category: z.string().optional(),
  search: z.string().max(80).optional(),
  premiumOnly: z.boolean().default(false)
});
