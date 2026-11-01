"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type AuditLog = {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "50" });
      if (action) query.set("action", action);
      if (targetType) query.set("target_type", targetType);
      const response = await fetch(`/api/admin/audit-logs?${query}`, { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; logs: AuditLog[]; total: number };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load audit logs.");
      setLogs(payload.logs);
      setTotal(payload.total);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load audit logs.");
    }
  }, [action, page, targetType]);

  useEffect(() => { void loadLogs(); }, [loadLogs]);

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="mb-6 text-3xl font-black">Audit log</h1>
        <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row">
          <label className="grid flex-1 gap-1 text-sm font-medium">Action<input className="h-10 rounded-xl border border-input bg-background px-3 font-normal" placeholder="Filter exact action" value={action} onChange={(event) => { setPage(1); setAction(event.target.value); }} /></label>
          <label className="grid gap-1 text-sm font-medium">Target type<select className="h-10 rounded-xl border border-input bg-background px-3 font-normal" value={targetType} onChange={(event) => { setPage(1); setTargetType(event.target.value); }}><option value="">All targets</option><option value="user">User</option><option value="instructor">Instructor</option><option value="instructor_application">Instructor application</option><option value="category">Category</option><option value="course">Course</option><option value="lesson">Lesson</option><option value="plan">Plan</option></select></label>
        </Card>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div><h2 className="font-semibold">{log.action}</h2><p className="text-sm text-muted-foreground">{log.target_type}: {log.target_id}</p><p className="mt-1 text-xs text-muted-foreground">Actor: {log.actor_id}</p></div>
                <time className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</time>
              </div>
              {Object.keys(log.meta || {}).length ? <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(log.meta, null, 2)}</pre> : null}
            </Card>
          ))}
          {logs.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No audit entries found.</Card> : null}
        </div>
        <div className="mt-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">{total} entries · page {page}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={page * 50 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
      </main>
    </PublicShell>
  );
}
