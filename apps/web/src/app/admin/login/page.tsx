"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedRole: "admin" })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Admin login failed.");
      const next = new URLSearchParams(window.location.search).get("next") || "/admin";
      router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-5 p-7 shadow-soft">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">LearnHub Admin</p>
          <h1 className="mt-2 text-3xl font-black">Admin login</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with the configured administrator account.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-2 text-sm font-medium">Admin email<Input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Password<Input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={loading}>{loading ? "Signing in..." : "Log in as admin"}</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">First-time setup? <Link className="font-semibold text-primary" href="/admin/register">Register admin account</Link></p>
        <p className="text-center text-sm text-muted-foreground"><Link className="font-semibold text-primary" href="/login">Back to user login</Link></p>
      </Card>
    </main>
  );
}
