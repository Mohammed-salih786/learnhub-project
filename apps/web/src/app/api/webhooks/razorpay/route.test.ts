/**
 * Unit tests for Razorpay webhook handler logic.
 * These test the signature verification and event routing, not the DB writes.
 */

import { afterEach, describe, it, expect, vi } from "vitest";
import { verifyWebhookSignature } from "@/lib/razorpay";

describe("verifyWebhookSignature", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a valid signature (local dev — no secret)", () => {
    // When RAZORPAY_WEBHOOK_SECRET is empty, verification is skipped (dev mode)
    const result = verifyWebhookSignature('{"event":"test"}', "any-signature");
    expect(result).toBe(true);
  });

  it("rejects webhook requests in production when no secret is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");

    expect(verifyWebhookSignature('{"event":"test"}', "any-signature")).toBe(false);
  });

  it("rejects malformed signatures without throwing", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "test-secret");

    expect(verifyWebhookSignature('{"event":"test"}', "not-hex")).toBe(false);
  });
});
