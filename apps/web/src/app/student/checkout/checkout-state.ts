export type CheckoutState = "loading" | "ready" | "processing" | "success" | "failed" | "cancelled";

export type CheckoutEvent =
  | "plans_loaded"
  | "start"
  | "payment_success"
  | "payment_failed"
  | "dismissed";

export function transitionCheckoutState(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  if (state === "loading" && event === "plans_loaded") return "ready";
  if ((state === "loading" || state === "ready") && event === "payment_failed") return "failed";
  if (state === "processing" && event === "payment_success") return "success";
  if (state === "processing" && event === "payment_failed") return "failed";
  if (state === "processing" && event === "dismissed") return "cancelled";
  if (["ready", "failed", "cancelled"].includes(state) && event === "start") return "processing";
  return state;
}
