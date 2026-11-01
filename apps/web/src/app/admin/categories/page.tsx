"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
};

const blankCategory = { name: "", slug: "", description: "", sort_order: "0", is_active: true };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(blankCategory);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/categories", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; categories: Category[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load categories.");
      setCategories(payload.categories);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load categories.");
    }
  }, []);

  useEffect(() => { void loadCategories(); }, [loadCategories]);

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories${editingId ? `/${encodeURIComponent(editingId)}` : ""}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim(),
          description: form.description,
          sort_order: Number(form.sort_order),
          is_active: form.is_active
        })
      });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not save category.");
      setEditingId(null);
      setForm(blankCategory);
      await loadCategories();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save category.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not delete category.");
      await loadCategories();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not delete category.");
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (category: Category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      sort_order: String(category.sort_order || 0),
      is_active: category.is_active
    });
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="mb-6 text-3xl font-black">Category management</h1>
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-xl font-bold">{editingId ? "Edit category" : "Add category"}</h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={saveCategory}>
            <label className="grid gap-1 text-sm font-medium">Name<input className="h-10 rounded-xl border border-input bg-background px-3 font-normal" maxLength={80} minLength={2} required value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium">Slug<input className="h-10 rounded-xl border border-input bg-background px-3 font-normal" maxLength={100} minLength={2} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={form.slug} onChange={(event) => setForm((value) => ({ ...value, slug: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium md:col-span-2">Description<textarea className="min-h-20 rounded-xl border border-input bg-background px-3 py-2 font-normal" maxLength={500} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
            <label className="grid gap-1 text-sm font-medium">Sort order<input className="h-10 rounded-xl border border-input bg-background px-3 font-normal" type="number" min={0} max={100000} value={form.sort_order} onChange={(event) => setForm((value) => ({ ...value, sort_order: event.target.value }))} /></label>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm((value) => ({ ...value, is_active: event.target.checked }))} />Active</label>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create category"}</Button>
              {editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(blankCategory); }}>Cancel</Button> : null}
            </div>
          </form>
        </Card>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div><div className="flex items-center gap-2"><h2 className="font-semibold">{category.name}</h2><Badge variant={category.is_active ? "default" : "secondary"}>{category.is_active ? "Active" : "Inactive"}</Badge></div><p className="text-sm text-muted-foreground">/{category.slug} · Order {category.sort_order}</p><p className="mt-1 text-sm">{category.description}</p></div>
              <div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => editCategory(category)}>Edit</Button><Button variant="destructive" disabled={saving} onClick={() => void deleteCategory(category)}>Delete</Button></div>
            </Card>
          ))}
          {categories.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No categories configured.</Card> : null}
        </div>
      </main>
    </PublicShell>
  );
}
