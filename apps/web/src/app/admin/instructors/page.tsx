"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Application = {
  id: string;
  user_id: string;
  status: string;
  bio?: string;
  headline?: string;
  sample_link?: string;
  rejection_reason?: string;
  verified_badge?: boolean;
  user?: { full_name?: string; email?: string } | null;
};

type Instructor = {
  id: string;
  full_name?: string;
  email?: string;
  status: string;
  verified_badge: boolean;
};

export default function AdminInstructorsPage() {
  const [status, setStatus] = useState("pending");
  const [applications, setApplications] = useState<Application[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Application | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const loadApplications = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/instructor-applications?status=${status}`, { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; applications: Application[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load applications.");
      setApplications(payload.applications);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load applications.");
    }
  }, [status]);

  const loadInstructors = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/instructors", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; instructors: Instructor[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load instructors.");
      setInstructors(payload.instructors);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load instructors.");
    }
  }, []);

  useEffect(() => { void loadApplications(); void loadInstructors(); }, [loadApplications, loadInstructors]);

  const decide = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const action = decisionAction;
      const response = await fetch(`/api/admin/instructor-applications/${encodeURIComponent(selected.id)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "reject" ? { reason: reason.trim() } : {})
      });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || `Could not ${action} application.`);
      setSelected(null);
      setReason("");
      await Promise.all([loadApplications(), loadInstructors()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update application.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBadge = async (userId: string, verified: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/instructors/${encodeURIComponent(userId)}/verification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified_badge: verified })
      });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not update verification.");
      await Promise.all([loadApplications(), loadInstructors()]);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update verification.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Admin console</p><h1 className="mt-2 text-3xl font-black">Instructor verification</h1></div>
          <label className="grid gap-2 text-sm font-medium">Application status
            <select className="h-10 rounded-xl border border-input bg-background px-3" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
          </label>
        </div>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-4">
          {applications.map((application) => (
            <Card key={application.id} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{application.user?.full_name || application.user?.email || "Applicant"}</h2><Badge variant={application.status === "approved" ? "default" : application.status === "rejected" ? "destructive" : "secondary"}>{application.status}</Badge></div>
                  <p className="text-sm text-muted-foreground">{application.headline}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{application.bio}</p>
                  {application.sample_link ? <a className="mt-2 inline-block text-sm text-primary underline" href={application.sample_link} rel="noreferrer" target="_blank">View sample</a> : null}
                  {application.rejection_reason ? <p className="mt-2 text-sm text-destructive">Reason: {application.rejection_reason}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {application.status === "pending" ? <>
                    <Button disabled={saving} onClick={() => { setSelected(application); setDecisionAction("approve"); setReason(""); }}>Approve</Button>
                    <Button variant="outline" disabled={saving} onClick={() => { setSelected(application); setDecisionAction("reject"); setReason(""); }}>Reject</Button>
                  </> : null}
                  {application.status === "approved" ? (
                    <Button variant="outline" disabled={saving} onClick={() => void toggleBadge(application.user_id, !application.verified_badge)}>
                      {application.verified_badge ? "Remove verified badge" : "Add verified badge"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
          {applications.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No applications found.</Card> : null}
        </div>
        <h2 className="mb-4 mt-10 text-2xl font-bold">Instructor badges</h2>
        <div className="space-y-3">
          {instructors.map((instructor) => (
            <Card key={instructor.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold">{instructor.full_name || instructor.email}</p><p className="text-sm text-muted-foreground">{instructor.email} · {instructor.status}</p></div>
              <div className="flex items-center gap-2"><Badge variant={instructor.verified_badge ? "default" : "secondary"}>{instructor.verified_badge ? "Verified" : "Not verified"}</Badge><Button variant="outline" disabled={saving} onClick={() => void toggleBadge(instructor.id, !instructor.verified_badge)}>{instructor.verified_badge ? "Remove badge" : "Add badge"}</Button></div>
            </Card>
          ))}
          {instructors.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No instructors found.</Card> : null}
        </div>
      </main>
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section aria-labelledby="application-decision-title" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-background p-6" role="dialog">
            <h2 id="application-decision-title" className="text-xl font-bold">{decisionAction === "reject" ? "Reject" : "Approve"} application</h2>
            <form className="mt-4 space-y-4" onSubmit={decide}>
              {decisionAction === "reject" ? (
                <label className="grid gap-2 text-sm font-medium">Rejection reason (required)
                  <textarea className="min-h-28 rounded-xl border border-input bg-background px-3 py-2 font-normal" minLength={10} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} />
                </label>
              ) : <p className="text-sm text-muted-foreground">Approve this applicant as a verified instructor?</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button>
                <Button type="submit" variant={decisionAction === "reject" ? "destructive" : "default"} disabled={saving || (decisionAction === "reject" && reason.trim().length < 10)}>
                  {decisionAction === "reject" ? "Reject application" : "Approve application"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </PublicShell>
  );
}
