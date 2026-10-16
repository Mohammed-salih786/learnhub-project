"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validateCourseDraft } from "@/lib/course";

const initialForm: {
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  description: string;
  priceCents: string;
  status: "draft" | "published";
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
  const [formState, setFormState] = useState(initialForm);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const payload = validateCourseDraft({
        ...formState,
        priceCents: Number(formState.priceCents)
      });

      setMessage(`Draft ready: ${payload.title} (${payload.status})`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Validation failed");
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
            <label className="text-sm font-medium">Category</label>
            <Input
              value={formState.category}
              onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value }))}
              placeholder="Product Design"
            />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Price (₹)</label>
            <Input
              type="number"
              value={formState.priceCents}
              onChange={(event) => setFormState((current) => ({ ...current, priceCents: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              value={formState.status}
              onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as "draft" | "published" }))}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline">
            Save draft
          </Button>
          <Button type="submit">Create course</Button>
        </div>
      </form>
    </Card>
  );
}
