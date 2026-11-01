"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ReviewCourse = { id: string; title: string; description?: string; status: "pending_review" | "rejected" | "published" | "unpublished" | "draft" | "archived"; rejection_reason?: string; instructor?: { full_name?: string; email?: string } | null };

export function CourseApprovalCard({
  course,
  onApprove,
  onReject,
  onUnpublish
}: {
  course: ReviewCourse;
  onApprove: (course: ReviewCourse) => void;
  onReject: (course: ReviewCourse) => void;
  onUnpublish: (course: ReviewCourse) => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{course.title}</h2>
            <Badge variant={course.status === "published" ? "default" : course.status === "rejected" ? "destructive" : "secondary"}>
              {course.status.replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Instructor: {course.instructor?.full_name || course.instructor?.email || "Unknown"}
          </p>
          {course.description ? <p className="mt-3 whitespace-pre-wrap text-sm">{course.description}</p> : null}
          {course.rejection_reason ? (
            <p className="mt-3 text-sm text-destructive">Rejection reason: {course.rejection_reason}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {course.status === "pending_review" ? (
            <>
              <Button type="button" onClick={() => onApprove(course)}>Approve</Button>
              <Button type="button" variant="outline" onClick={() => onReject(course)}>Reject</Button>
            </>
          ) : null}
          {course.status === "published" ? (
            <Button type="button" variant="outline" onClick={() => onUnpublish(course)}>Unpublish</Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

