import { describe, expect, it } from "vitest";

import { transitionCheckoutState } from "./checkout-state";

describe("checkout state transitions", () => {
  it("moves through loading, processing, and success", () => {
    expect(transitionCheckoutState("loading", "plans_loaded")).toBe("ready");
    expect(transitionCheckoutState("ready", "start")).toBe("processing");
    expect(transitionCheckoutState("processing", "payment_success")).toBe("success");
  });

  it("shows failed checkout and allows retry", () => {
    expect(transitionCheckoutState("processing", "payment_failed")).toBe("failed");
    expect(transitionCheckoutState("failed", "start")).toBe("processing");
    expect(transitionCheckoutState("ready", "payment_failed")).toBe("failed");
  });

  it("shows dismissal and allows the student to retry", () => {
    expect(transitionCheckoutState("processing", "dismissed")).toBe("cancelled");
    expect(transitionCheckoutState("cancelled", "start")).toBe("processing");
    expect(transitionCheckoutState("success", "start")).toBe("success");
  });
});
