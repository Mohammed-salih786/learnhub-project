import * as React from "react";
import { getBilling } from "./demo-payments";
export function useEntitlement(backendHasSubscription = false) {
  const [demo, setDemo] = React.useState(false);
  React.useEffect(() => { const update = () => setDemo(getBilling().currentSubscription?.status === "active"); update(); window.addEventListener("demo-billing-change", update); window.addEventListener("storage", update); return () => { window.removeEventListener("demo-billing-change", update); window.removeEventListener("storage", update); }; }, []);
  return { hasActiveSubscription: backendHasSubscription || demo, source: demo ? "demo" as const : "backend" as const };
}
