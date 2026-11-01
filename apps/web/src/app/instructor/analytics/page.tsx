"use client";

import * as React from "react";
import { useEffect, useState } from "react";

import { InstructorShell } from "@/components/layout/instructor-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Earnings = { pending_amount_cents: number; paid_amount_cents: number };

function price(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount / 100);
}

export default function InstructorAnalyticsPage() {
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/instructor/earnings", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok: boolean; error?: string; earnings?: Earnings };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load earnings.");
        if (active && payload.earnings) setEarnings(payload.earnings);
      })
      .catch((caughtError: unknown) => {
        if (active) setError(caughtError instanceof Error ? caughtError.message : "Could not load earnings.");
      });
    return () => { active = false; };
  }, []);

  return (
    <InstructorShell>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Instructor</p>
            <h1 className="mt-1 text-2xl font-black">Analytics</h1>
          </div>
          <Badge variant="secondary">Estimate</Badge>
        </div>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Enrollments</p>
            <p className="mt-1 text-3xl font-black">—</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg. score</p>
            <p className="mt-1 text-3xl font-black">—</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending earnings</p>
            <p className="mt-1 text-3xl font-black">{earnings ? price(earnings.pending_amount_cents) : "—"}</p>
          </Card>
        </div>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Estimated pending earnings are allocated using your learners&apos; share of platform watch time and a 70% instructor revenue pool.
            Final payout amounts are reviewed and recorded by the admin team.
          </p>
          <p className="mt-3 text-sm">Paid to date: {earnings ? price(earnings.paid_amount_cents) : "—"}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Contact{" "}
            <a href="mailto:support@learnhub.in" className="text-primary underline">
              support@learnhub.in
            </a>{" "}
            for payout inquiries.
          </p>
        </Card>
      </main>
    </InstructorShell>
  );
}
