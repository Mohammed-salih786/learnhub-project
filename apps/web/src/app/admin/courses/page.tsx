"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CourseApprovalCard } from "./course-approval-card";

const courseStatuses = ["pending_review", "rejected", "published", "unpublished", "draft", "archived"] as const;
type CourseStatus = typeof courseStatuses[number];

type ReviewCourse = {
  id: string;
  title: string;
  description?: string;
  status: CourseStatus;
  rejection_reason?: string;
  instructor?: { full_name?: string; email?: string } | null;
};

type CoursesResponse = {
  ok: boolean;
  error?: string;
  courses: ReviewCourse[];
};

async function readError(response: Response, fallback: string) {
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || fallback);
  }
}

export default function AdminCoursesPage() {
  const [status, setStatus] = useState<CourseStatus>("pending_review");
  const [courses, setCourses] = useState<ReviewCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<ReviewCourse | null>(null);
  const [decisionAction, setDecisionAction] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/courses?status=${status}`, { cache: "no-store" });
      const payload = await response.json() as CoursesResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Could not load courses.");
      }
      setCourses(payload.courses);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load courses.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const actOnCourse = async (course: ReviewCourse, action: "approve" | "unpublish") => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(course.id)}/${action}`, {
        method: "POST"
      });
      await readError(response, `Could not ${action} course.`);
      await loadCourses();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `Could not ${action} course.`);
    } finally {
      setSaving(false);
    }
  };

  const approveCourse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(selectedCourse.id)}/approve`, {
        method: "POST"
      });
      await readError(response, "Could not approve course.");
      setSelectedCourse(null);
      setDecisionAction(null);
      await loadCourses();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not approve course.");
    } finally {
      setSaving(false);
    }
  };

  const rejectCourse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(selectedCourse.id)}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() })
      });
      await readError(response, "Could not reject course.");
      setSelectedCourse(null);
      setDecisionAction(null);
      setReason("");
      await loadCourses();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not reject course.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Admin console</p>
            <h1 className="mt-2 text-3xl font-black">Course approvals</h1>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Filter by status
            <select
              aria-label="Filter by status"
              className="h-10 rounded-xl border border-input bg-background px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value as CourseStatus)}
            >
              {courseStatuses.map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p role="alert" className="mb-5 text-sm text-destructive">{error}</p> : null}
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading courses...</p> : null}
        {!loading && courses.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No courses found with this status.</Card>
        ) : null}
        <div className="space-y-4">
          {courses.map((course) => (
            <CourseApprovalCard
              key={course.id}
              course={course}
              onApprove={(selected) => {
                setSelectedCourse(selected);
                setDecisionAction("approve");
              }}
              onReject={(selected) => {
                setSelectedCourse(selected);
                setDecisionAction("reject");
                setReason("");
              }}
              onUnpublish={(selected) => void actOnCourse(selected, "unpublish")}
            />
          ))}
        </div>
        {saving ? <p role="status" className="mt-4 text-sm text-muted-foreground">Saving course decision...</p> : null}
      </main>

      {selectedCourse && decisionAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section
            aria-labelledby="reject-course-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl"
            role="dialog"
          >
            <h2 id="reject-course-title" className="text-xl font-bold">
              {decisionAction === "approve" ? "Approve" : "Reject"} {selectedCourse.title}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={decisionAction === "approve" ? approveCourse : rejectCourse}>
              {decisionAction === "approve" ? (
                <p className="text-sm text-muted-foreground">This course will be published and made visible to students.</p>
              ) : (
                <label className="grid gap-2 text-sm font-medium">
                  Reason (required)
                  <textarea
                    autoFocus
                    className="min-h-28 rounded-xl border border-input bg-background px-3 py-2 font-normal"
                    maxLength={1000}
                    minLength={10}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    value={reason}
                  />
                </label>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={() => {
                  setSelectedCourse(null);
                  setDecisionAction(null);
                }}>Cancel</Button>
                <Button
                  type="submit"
                  variant={decisionAction === "approve" ? "default" : "destructive"}
                  disabled={saving || (decisionAction === "reject" && reason.trim().length < 10)}
                >
                  {decisionAction === "approve" ? "Approve course" : "Reject course"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </PublicShell>
  );
}
