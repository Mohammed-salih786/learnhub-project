import { z } from "zod";

import { courseDraftSchema, lessonDraftSchema } from "@learnhub/shared";

export function validateCourseDraft(payload: unknown) {
  return courseDraftSchema.parse(payload);
}

export function validateLessonDraft(payload: unknown) {
  return lessonDraftSchema.parse(payload);
}

export const courseDraftRefinement = z.object({
  title: z.string().min(3).max(120),
  slug: z.string().min(3).max(80),
  category: z.string().min(2).max(60),
  shortDescription: z.string().min(20).max(220),
  description: z.string().min(50).max(2000),
  priceCents: z.number().int().nonnegative().default(0),
  status: z.enum(["draft", "published"]).default("draft")
});
