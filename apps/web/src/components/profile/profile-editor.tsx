"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ProfileData = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url?: string | null;
};

export function ProfileEditor({ role }: { role: "student" | "instructor" }) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [bio, setBio] = useState("");
  const [headline, setHeadline] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadProfile() {
    setLoading(true);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load your profile.");
      setProfile(result.profile);
      setBio(result.instructorProfile?.bio ?? "");
      setHeadline(result.instructorProfile?.headline ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.get("fullName"),
          phone: form.get("phone"),
          bio,
          headline
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save your profile.");
      setNotice("Profile updated successfully.");
      setEditing(false);
      await loadProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  const name = profile?.full_name || (role === "student" ? "Learner" : "Instructor");
  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{role === "student" ? "Account" : "Instructor"}</p>
        <h1 className="mt-1 text-2xl font-black">{role === "student" ? "My profile" : "Your profile"}</h1>
      </div>
      <Card className="space-y-5 p-6">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? <Image src={profile.avatar_url} alt="Profile" width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-black text-primary-foreground">{name[0]?.toUpperCase()}</div>}
          <div>
            <div className="flex items-center gap-2"><p className="font-semibold">{name}</p>{role === "instructor" && <Badge variant="secondary">Instructor</Badge>}</div>
            <p className="text-sm text-muted-foreground">{profile?.email ?? (loading ? "Loading profile…" : "Email not set")}</p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={save} className="space-y-4 border-t border-border pt-4">
            <label className="block space-y-1.5 text-sm font-medium">Full name<Input name="fullName" required minLength={2} maxLength={120} defaultValue={profile?.full_name ?? ""} /></label>
            <label className="block space-y-1.5 text-sm font-medium">Phone number<Input name="phone" type="tel" maxLength={25} defaultValue={profile?.phone ?? ""} /></label>
            {role === "instructor" && <>
              <label className="block space-y-1.5 text-sm font-medium">Headline<Input value={headline} maxLength={120} onChange={(event) => setHeadline(event.target.value)} placeholder="e.g. Product designer and educator" /></label>
              <label className="block space-y-1.5 text-sm font-medium">Bio<textarea className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={bio} maxLength={1000} onChange={(event) => setBio(event.target.value)} placeholder="Tell learners about your experience" /></label>
            </>}
            <div className="flex gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button><Button type="button" variant="outline" disabled={saving} onClick={() => { setEditing(false); setError(""); void loadProfile(); }}>Cancel</Button></div>
          </form>
        ) : (
          <>
            <div className="space-y-3 border-t border-border pt-4">
              <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{profile?.phone || "Not set"}</p></div>
              {role === "student" ? <div><p className="text-xs text-muted-foreground">Plan</p><p className="text-sm font-medium">Free Trial (7 days)</p></div> : <><div><p className="text-xs text-muted-foreground">Headline</p><p className="text-sm font-medium">{headline || "No headline added yet."}</p></div><div><p className="text-xs text-muted-foreground">Bio</p><p className="whitespace-pre-wrap text-sm">{bio || "No bio added yet."}</p></div></>}
            </div>
            <div className="border-t border-border pt-4"><Button className="w-full" onClick={() => { setError(""); setNotice(""); setEditing(true); }}>Edit profile</Button></div>
          </>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}
      </Card>
      {role === "student" && <p className="mt-6 text-center text-xs text-muted-foreground">Need help? <a href="mailto:support@learnhub.in" className="text-primary underline">Contact support</a></p>}
    </main>
  );
}
