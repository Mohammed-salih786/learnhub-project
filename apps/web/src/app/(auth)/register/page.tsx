"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/password/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName, email, password, role }) });
      const contentType = response.headers.get("content-type") || "";
      const result = contentType.includes("application/json") ? await response.json() : null;
      if (!result) throw new Error("LearnHub API is unavailable. Start the Flask backend and check its MongoDB Atlas settings.");
      if (!response.ok || !result.ok) throw new Error(result.error || "Registration failed.");
      if (result.requiresEmailConfirmation) setMessage("Account created. Check your email for the confirmation link, then log in.");
      else { router.push("/" + result.user.role); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Registration failed."); }
    finally { setLoading(false); }
  }
  return <main className="flex min-h-[75vh] items-center justify-center px-4 py-12"><Card className="w-full max-w-md space-y-5 p-7 shadow-soft">
    <div><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">LearnHub</p><h1 className="mt-2 text-3xl font-black">Create your account</h1><p className="mt-2 text-sm text-muted-foreground">Register with an email and password.</p></div>
    <form className="space-y-4" onSubmit={submit}>
      <label className="block space-y-2 text-sm font-medium">Full name<Input autoComplete="name" required minLength={2} maxLength={120} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">Email<Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
      <label className="block space-y-2 text-sm font-medium">Password<Input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /><span className="block text-xs font-normal text-muted-foreground">Use at least 8 characters.</span></label>
      <label className="block space-y-2 text-sm font-medium">Account type<select className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm" value={role} onChange={e => setRole(e.target.value as "student" | "instructor")}><option value="student">Student</option><option value="instructor">Instructor</option></select></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}{message && <p role="status" className="text-sm text-primary">{message}</p>}
      <Button className="w-full" type="submit" disabled={loading}>{loading ? "Creating account..." : "Register"}</Button>
    </form>
    <p className="text-center text-sm text-muted-foreground">Already registered? <Link className="font-semibold text-primary" href="/login">Log in</Link></p>
    <p className="text-center text-sm text-muted-foreground">Administrator? <Link className="font-semibold text-primary" href="/admin/register">Admin registration</Link></p>
  </Card></main>;
}
