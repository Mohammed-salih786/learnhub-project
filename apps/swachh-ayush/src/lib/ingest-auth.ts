import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export function isAuthorizedIngestRequest(request: NextRequest): boolean {
  const expected = process.env.SWACHH_INGEST_API_KEY;
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
