"use client";

import * as React from "react";
import { useCallback, useEffect, useState } from "react";

import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AdminUser = {
  id: string;
  email?: string;
  full_name?: string;
  role: string;
  status: string;
  created_at?: string;
};

type UserDetail = {
  profile: AdminUser;
  subscription: { status?: string; plan_id?: string; ends_at?: string } | null;
  enrolled_courses: Array<{ course: { title?: string } | null }>;
  payments: Array<{ id: string; status?: string; amount_cents?: number; created_at?: string }>;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setError(null);
    try {
      const query = new URLSearchParams({ page: String(page), limit: "25" });
      if (searchTerm) query.set("search", searchTerm);
      if (role) query.set("role", role);
      if (status) query.set("status", status);
      const response = await fetch(`/api/admin/users?${query}`, { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string; users: AdminUser[]; total: number };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load users.");
      setUsers(payload.users);
      setTotal(payload.total);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load users.");
    }
  }, [page, role, searchTerm, status]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const viewUser = async (userId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; error?: string } & UserDetail;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Could not load user.");
      setSelected(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load user.");
    }
  };

  const setUserStatus = async (user: AdminUser, action: "suspend" | "reactivate" | "delete") => {
    if (!window.confirm(`${action === "delete" ? "Soft-delete" : action} ${user.email || user.full_name || "this user"}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/${action}`, { method: "POST" });
      const payload = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.error || `Could not ${action} user.`);
      await loadUsers();
      if (selected?.profile.id === user.id) setSelected(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `Could not ${action} user.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="mb-6 text-3xl font-black">User management</h1>
        <Card className="mb-5 p-4">
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]" onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearchTerm(search.trim());
          }}>
            <input aria-label="Search users" className="h-10 rounded-xl border border-input bg-background px-3" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filter by role" className="h-10 rounded-xl border border-input bg-background px-3" value={role} onChange={(event) => { setPage(1); setRole(event.target.value); }}>
              <option value="">All roles</option><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option>
            </select>
            <select aria-label="Filter by status" className="h-10 rounded-xl border border-input bg-background px-3" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
              <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="deleted">Deleted</option>
            </select>
            <Button type="submit">Search</Button>
          </form>
        </Card>
        {error ? <p role="alert" className="mb-4 text-sm text-destructive">{error}</p> : null}
        <div className="space-y-3">
          {users.map((user) => (
            <Card key={user.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <button type="button" className="text-left" onClick={() => void viewUser(user.id)}>
                <span className="block font-semibold">{user.full_name || user.email}</span>
                <span className="text-sm text-muted-foreground">{user.email} · {user.role}</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={user.status === "active" ? "default" : user.status === "suspended" ? "destructive" : "secondary"}>{user.status}</Badge>
                {user.status === "active" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void setUserStatus(user, "suspend")}>Suspend</Button> : null}
                {user.status === "suspended" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void setUserStatus(user, "reactivate")}>Reactivate</Button> : null}
                {user.status !== "deleted" ? <Button size="sm" variant="destructive" disabled={busy} onClick={() => void setUserStatus(user, "delete")}>Soft delete</Button> : null}
              </div>
            </Card>
          ))}
          {users.length === 0 ? <Card className="p-8 text-center text-sm text-muted-foreground">No users found.</Card> : null}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{total} users · page {page}</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
            <Button variant="outline" disabled={page * 25 >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
          </div>
        </div>
      </main>
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section aria-labelledby="user-detail-title" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="user-detail-title" className="text-xl font-bold">{selected.profile.full_name || selected.profile.email}</h2><p className="text-sm text-muted-foreground">{selected.profile.email}</p></div>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <Card className="p-4"><p className="text-sm text-muted-foreground">Subscription</p><p className="mt-1 font-semibold">{selected.subscription?.status || "None"}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted-foreground">Enrollments</p><p className="mt-1 font-semibold">{selected.enrolled_courses.length}</p></Card>
              <Card className="p-4"><p className="text-sm text-muted-foreground">Payments</p><p className="mt-1 font-semibold">{selected.payments.length}</p></Card>
            </div>
            {selected.subscription?.ends_at ? <p className="mt-4 text-sm text-muted-foreground">Subscription ends: {new Date(selected.subscription.ends_at).toLocaleDateString()}</p> : null}
            <h3 className="mb-2 mt-5 font-semibold">Enrolled courses</h3>
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              {selected.enrolled_courses.map((item, index) => <li key={`${item.course?.title || "course"}-${index}`}>{item.course?.title || "Course unavailable"}</li>)}
            </ul>
            <h3 className="mb-2 mt-5 font-semibold">Payment history</h3>
            <div className="space-y-2">
              {selected.payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <span>{payment.status || "Unknown"} · {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : "Date unavailable"}</span>
                  <span>{typeof payment.amount_cents === "number" ? `₹${(payment.amount_cents / 100).toFixed(2)}` : "Amount unavailable"}</span>
                </div>
              ))}
              {selected.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments found.</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </PublicShell>
  );
}
