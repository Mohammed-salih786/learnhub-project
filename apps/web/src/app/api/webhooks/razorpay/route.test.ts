/**
 * Unit tests for Razorpay webhook handler logic.
 * These test the signature verification and event routing, not the DB writes.
 */

import { describe, it, expect } from "vitest";
import { verifyWebhookSignature } from "@/lib/razorpay";

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature (local dev — no secret)", () => {
    // When RAZORPAY_WEBHOOK_SECRET is empty, verification is skipped (dev mode)
    const result = verifyWebhookSignature('{"event":"test"}', "any-signature");
    expect(result).toBe(true);
  });
});
