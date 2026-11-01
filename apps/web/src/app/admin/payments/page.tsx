"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Payment = {
  id: string;
  user_id: string;
  amount_cents: number;
  status: string;
  created_at?: string;
  razorpay_order_id?: string;
};

function price(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100);
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    setError(null);
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const response = await fetch(`/api/admin/payments${query}`, { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; payments: Payment[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load payments.");
      setPayments(payload.payments);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load payments.");
    }
  }, [status]);

  useEffect(() => { void loadPayments(); }, [loadPayments]);

  const refund = async (payment: Payment) => {
    if (!window.confirm(`Refund ${price(payment.amount_cents)} to the original payment method?`)) return;
    setBusy(payment.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payments/${encodeURIComponent(payment.id)}/refund`, { method: "POST" });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not refund payment.");
      await loadPayments();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not refund payment.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground">Admin</p>
            <h1 className="text-3xl font-black">Payments</h1>
          </div>
          <label className="text-sm">
            Status{" "}
            <select className="rounded-md border bg-background p-2" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="created">Created</option>
              <option value="captured">Captured</option>
              <option value="failed">Failed</option>
              <option value="refund_pending">Refund pending</option>
              <option value="refunded">Refunded</option>
              <option value="partially_refunded">Partially refunded</option>
            </select>
          </label>
        </div>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <Card className="divide-y p-5">
          {payments.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div>
                <p className="font-semibold">{price(payment.amount_cents)}</p>
                <p className="text-sm text-muted-foreground">User {payment.user_id} · {payment.created_at ? new Date(payment.created_at).toLocaleString() : payment.id}</p>
                <p className="text-xs text-muted-foreground">{payment.razorpay_order_id || "Order pending"}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={payment.status === "captured" ? "default" : payment.status === "failed" ? "destructive" : "secondary"}>{payment.status}</Badge>
                {payment.status === "captured" ? (
                  <Button variant="outline" disabled={busy !== null} onClick={() => void refund(payment)}>
                    {busy === payment.id ? "Refunding..." : "Refund"}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {payments.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No payments match this filter.</p> : null}
        </Card>
      </main>
    </PublicShell>
  );
}
