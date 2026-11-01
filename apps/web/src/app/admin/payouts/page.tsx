"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Payout = {
  id: string;
  instructor?: { email?: string; full_name?: string } | null;
  pending_amount_cents: number;
  paid_amount_cents: number;
  pending_shares: number;
};

function price(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100);
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadPayouts = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/payouts", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; payouts: Payout[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load payouts.");
      setPayouts(payload.payouts);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load payouts.");
    }
  }, []);

  useEffect(() => { void loadPayouts(); }, [loadPayouts]);

  const markPaid = async (payout: Payout) => {
    const reference = window.prompt("Enter the bank transfer or payout reference number:");
    if (!reference?.trim()) return;
    setBusy(payout.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payouts/${encodeURIComponent(payout.id)}/mark-paid`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: reference.trim() })
      });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not mark payout paid.");
      await loadPayouts();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not mark payout paid.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="mb-6 text-3xl font-black">Instructor payouts</h1>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-4">
          {payouts.map((payout) => (
            <Card key={payout.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold">{payout.instructor?.full_name || payout.instructor?.email || payout.id}</p>
                <p className="text-sm text-muted-foreground">
                  Pending {price(payout.pending_amount_cents)} ({payout.pending_shares} shares) · Paid {price(payout.paid_amount_cents)}
                </p>
              </div>
              {payout.pending_amount_cents > 0 ? (
                <Button disabled={busy !== null} onClick={() => void markPaid(payout)}>
                  {busy === payout.id ? "Saving..." : "Mark pending shares paid"}
                </Button>
              ) : null}
            </Card>
          ))}
          {payouts.length === 0 ? <Card className="p-5 text-sm text-muted-foreground">No instructor payouts have accrued.</Card> : null}
        </div>
      </main>
    </PublicShell>
  );
}
