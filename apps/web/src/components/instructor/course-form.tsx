"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { instructorCourseCreateSchema } from "@learnhub/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FileUploader } from "@/components/instructor/file-uploader";

const initialForm: {
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  priceCents: string;
  status: "draft" | "pending_review";
} = {
  title: "",
  slug: "",
  category: "",
  shortDescription: "",
  description: "",
  priceCents: "29900",
  status: "draft"
};

export function CourseForm() {
  const router = useRouter();
  const [formState, setFormState] = useState(initialForm);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  useEffect(() => {
    void fetch("/api/categories", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { ok: boolean; categories?: Array<{ id: string; name: string }>; error?: string };
        if (!response.ok || !payload.ok || !payload.categories) {
          throw new Error(payload.error || "Could not load course categories.");
        }
        setCategories(payload.categories);
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load course categories.");
      });
  }, []);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const payload = instructorCourseCreateSchema.parse({
        title: formState.title,
        ...(formState.slug ? { slug: formState.slug } : {}),
        ...(formState.category ? { category_id: formState.category } : {}),
        shortDescription: formState.shortDescription,
        description: formState.description,
        priceCents: Number(formState.priceCents),
        ...(thumbnailUrl ? { thumbnailUrl } : {})
      });
      setSaving(true);
      const response = await fetch("/api/instructor/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: payload.title,
          slug: payload.slug,
          category_id: payload.category_id,
          shortDescription: payload.shortDescription,
          description: payload.description,
          priceCents: payload.priceCents,
          thumbnailUrl: payload.thumbnailUrl
        })
      });
      const result = await response.json() as { ok: boolean; error?: string; course?: { id: string } };
      if (!response.ok || !result.ok || !result.course) {
        throw new Error(result.error || "Could not create course.");
      }
      router.push(`/instructor/courses/${encodeURIComponent(result.course.id)}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Validation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Course title</label>
            <Input
              value={formState.title}
              onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
              placeholder="Build a product research system"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Slug</label>
            <Input
              value={formState.slug}
              onChange={(event) => setFormState((current) => ({ ...current, slug: event.target.value }))}
              placeholder="product-research-system"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="course-category">Category</label>
            <select
              id="course-category"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formState.category}
              onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">Select category (optional)</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Short description</label>
            <Input
              value={formState.shortDescription}
              onChange={(event) => setFormState((current) => ({ ...current, shortDescription: event.target.value }))}
              placeholder="Short, buyer-focused pitch for your course"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Long description</label>
            <textarea
              value={formState.description}
              onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Describe outcomes, prerequisites, and learning path"
            />
          </div>
          <div className="md:col-span-2"><FileUploader label="Course thumbnail" accept=".png,.jpg,.jpeg,.webp" onUploaded={(url) => setThumbnailUrl(url)} />{thumbnailUrl && <p className="mt-1 break-all text-xs text-muted-foreground">{thumbnailUrl}</p>}</div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Price (₹)</label>
            <Input
              type="number"
              value={formState.priceCents}
              onChange={(event) => setFormState((current) => ({ ...current, priceCents: event.target.value }))}
            />
          </div>
          <p className="self-center text-sm text-muted-foreground">
            New courses start as drafts. Add at least one lesson, then submit from the course studio.
          </p>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={saving} onClick={() => void handleSubmit()}>
            Save draft
          </Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Create course"}</Button>
        </div>
      </form>
    </Card>
  );
}
