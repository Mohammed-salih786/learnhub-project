"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminRegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/admin/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, setupKey })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Admin registration failed.");
      router.replace("/admin");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[75vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md space-y-5 p-7 shadow-soft">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">LearnHub Admin</p>
          <h1 className="mt-2 text-3xl font-black">Admin registration</h1>
          <p className="mt-2 text-sm text-muted-foreground">Use the configured admin email and setup key from the workspace root .env file.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-2 text-sm font-medium">Full name<Input autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Admin email<Input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Password<Input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={event => setPassword(event.target.value)} /><span className="block text-xs font-normal text-muted-foreground">Use at least 12 characters.</span></label>
          <label className="block space-y-2 text-sm font-medium">Admin setup key<Input type="password" autoComplete="off" required value={setupKey} onChange={event => setSetupKey(event.target.value)} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" type="submit" disabled={loading}>{loading ? "Creating admin..." : "Register admin"}</Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">Already set up? <Link className="font-semibold text-primary" href="/admin/login">Admin login</Link></p>
      </Card>
    </main>
  );
}
