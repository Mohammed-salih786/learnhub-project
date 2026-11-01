import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CourseApprovalCard } from "./course-approval-card";

describe("course approval UI", () => {
  it("shows approval and rejection actions for courses awaiting review", () => {
    const markup = renderToStaticMarkup(createElement(CourseApprovalCard, {
      course: {
        id: "course-1",
        title: "Product design",
        status: "pending_review",
        instructor: { full_name: "Learn Hub" }
      },
      onApprove: vi.fn(),
      onReject: vi.fn(),
      onUnpublish: vi.fn()
    }));

    expect(markup).toContain("Product design");
    expect(markup).toContain("pending review");
    expect(markup).toContain(">Approve</");
    expect(markup).toContain(">Reject</");
    expect(markup).toContain("Instructor: Learn Hub");
  });

  it("displays the stored rejection reason for rejected courses", () => {
    const markup = renderToStaticMarkup(createElement(CourseApprovalCard, {
      course: {
        id: "course-2",
        title: "Design basics",
        status: "rejected",
        rejection_reason: "Add a clearer outline."
      },
      onApprove: vi.fn(),
      onReject: vi.fn(),
      onUnpublish: vi.fn()
    }));

    expect(markup).toContain("Rejection reason: Add a clearer outline.");
    expect(markup).not.toContain(">Approve</");
  });
});
