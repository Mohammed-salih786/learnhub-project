"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/password/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Login failed.");
      const next = new URLSearchParams(window.location.search).get("next") || "/" + result.user.role;
      router.push(next.startsWith("/") && !next.startsWith("//") ? next : "/" + result.user.role); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed."); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-[75vh] items-center justify-center px-4 py-12"><Card className="w-full max-w-md space-y-5 p-7 shadow-soft">
    <div><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">LearnHub</p><h1 className="mt-2 text-3xl font-black">Log in</h1><p className="mt-2 text-sm text-muted-foreground">Sign in with your email and password.</p></div>
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-2 text-sm font-medium">Email<Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">Password<Input type="password" autoComplete="current-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" type="submit" disabled={loading}>{loading ? "Signing in..." : "Log in"}</Button>
    </form>
    <p className="text-center text-sm text-muted-foreground">New to LearnHub? <Link className="font-semibold text-primary" href="/register">Create an account</Link></p>
    <p className="text-center text-sm text-muted-foreground">Administrator? <Link className="font-semibold text-primary" href="/admin/login">Admin login</Link></p>
  </Card></main>;
}
