"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileUploader } from "@/components/instructor/file-uploader";

type Course = {
  id: string;
  title: string;
  status: string;
  rejection_reason?: string;
};

type Lesson = {
  id: string;
  title: string;
  sort_order?: number;
};

type StudioResponse = {
  ok: boolean;
  error?: string;
  course: Course;
  lessons: Lesson[];
};

async function fetchStudio(courseId: string): Promise<StudioResponse> {
  const response = await fetch(`/api/instructor/courses/${encodeURIComponent(courseId)}/studio`, {
    cache: "no-store"
  });
  const payload = await response.json() as StudioResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Could not load course details.");
  }
  return payload;
}

export default function CourseStudioPage({ params }: { params: { id: string } }) {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchStudio(params.id);
      setCourse(payload.course);
      setLessons(payload.lessons);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load course details.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const submitForReview = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/instructor/courses/${encodeURIComponent(params.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "pending_review" })
      });
      const payload = await response.json() as { ok: boolean; error?: string; course?: Course };
      if (!response.ok || !payload.ok || !payload.course) {
        throw new Error(payload.error || "Could not submit course for review.");
      }
      setCourse(payload.course);
      setNotice("Course submitted for review.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not submit course for review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Course studio</p>
            <h1 className="mt-2 text-3xl font-black">{loading ? "Loading course..." : course?.title || "Course unavailable"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Course ID: {params.id}</p>
          </div>
          {course ? (
            <div className="flex items-center gap-3">
              <Badge variant={course.status === "published" ? "default" : course.status === "rejected" ? "destructive" : "secondary"}>
                {course.status.replaceAll("_", " ")}
              </Badge>
              {course.status !== "pending_review" && course.status !== "archived" ? (
                <Button type="button" onClick={submitForReview} disabled={saving}>
                  {saving ? "Submitting..." : "Submit for review"}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {error ? <p role="alert" className="mb-5 text-sm text-destructive">{error}</p> : null}
        {notice ? <p role="status" className="mb-5 text-sm text-emerald-600">{notice}</p> : null}
        {course?.rejection_reason ? (
          <Card className="mb-6 border-destructive/40 p-5">
            <h2 className="font-bold">Rejection reason</h2>
            <p className="mt-2 text-sm text-muted-foreground">{course.rejection_reason}</p>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">Lessons</h2>
            {loading ? <p className="text-sm text-muted-foreground">Loading lessons…</p> : null}
            {!loading && lessons.length === 0 ? <p className="text-sm text-muted-foreground">Add at least one lesson before submitting for review.</p> : null}
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="rounded-xl border border-border bg-muted/40 p-3">
                  <p className="mb-3 font-medium">{lesson.title}</p>
                  <FileUploader label="Upload lesson resource" onUploaded={async (url, filename) => { const response = await fetch(`/api/instructor/lessons/${encodeURIComponent(lesson.id)}/resources`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: filename, resourceType: "file", url }) }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || "Could not attach lesson resource."); }} />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">Review workflow</h2>
            <p className="text-sm text-muted-foreground">
              Save your course as a draft, then submit it for admin review. It will become visible to students after approval.
            </p>
          </Card>
        </div>
      </main>
    </PublicShell>
  );
}
