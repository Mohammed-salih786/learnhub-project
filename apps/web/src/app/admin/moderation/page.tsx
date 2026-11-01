"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Flag = {
  id: string;
  target_type: "course" | "lesson" | "user";
  target_id: string;
  reason: string;
  severity: string;
  status: string;
};

export default function AdminModerationPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [unpublishCourse, setUnpublishCourse] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/moderation", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; flags: Flag[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load moderation flags.");
      setFlags(payload.flags);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load moderation flags.");
    }
  }, []);

  useEffect(() => { void loadFlags(); }, [loadFlags]);

  const resolveFlag = async (flag: Flag, status: "resolved" | "dismissed") => {
    setSavingId(flag.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/moderation/${encodeURIComponent(flag.id)}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          unpublishCourse: status === "resolved" && Boolean(unpublishCourse[flag.id])
        })
      });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not resolve moderation flag.");
      await loadFlags();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not resolve moderation flag.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="mb-6 text-3xl font-black">Moderation</h1>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-4">
          {flags.map((flag) => (
            <Card key={flag.id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{flag.target_type}: {flag.target_id}</h2><Badge variant={flag.severity === "high" ? "destructive" : flag.severity === "medium" ? "secondary" : "outline"}>{flag.severity}</Badge><Badge>{flag.status}</Badge></div>
                  <p className="mt-2 text-sm text-muted-foreground">{flag.reason}</p>
                  {flag.target_type === "course" && flag.status === "pending" ? (
                    <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(unpublishCourse[flag.id])} onChange={(event) => setUnpublishCourse((value) => ({ ...value, [flag.id]: event.target.checked }))} />Unpublish course when resolving</label>
                  ) : null}
                </div>
                {flag.status === "pending" ? <div className="flex gap-2"><Button disabled={savingId === flag.id} onClick={() => void resolveFlag(flag, "resolved")}>Resolve</Button><Button variant="outline" disabled={savingId === flag.id} onClick={() => void resolveFlag(flag, "dismissed")}>Dismiss</Button></div> : null}
              </div>
            </Card>
          ))}
          {flags.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No moderation flags.</Card> : null}
        </div>
      </main>
    </PublicShell>
  );
}
