"use client";

import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProgressRing } from "@/components/ui/progress-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toast } from "@/components/ui/toast";

const demoCourses = ["React for Beginners", "UI Design Fundamentals", "TypeScript Essentials"];
export default function DesignPage() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState("overview");
  const [selectedButton, setSelectedButton] = useState("Primary");
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const filteredCourses = useMemo(() => demoCourses.filter((course) => course.toLowerCase().includes(search.toLowerCase())), [search]);

  return (
    <main className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-background p-6 text-foreground"><div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between"><div><p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Design system</p><h1 className="mt-2 text-3xl font-black">LearnHub UI Kit</h1></div><Button variant="outline" onClick={() => setDark((value) => !value)}>{dark ? "Light mode" : "Dark mode"}</Button></div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Buttons</h3><div className="flex flex-wrap gap-2"><Button aria-pressed={selectedButton === "Primary"} onClick={() => setSelectedButton("Primary")}>Primary</Button><Button aria-pressed={selectedButton === "Secondary"} variant="secondary" onClick={() => setSelectedButton("Secondary")}>Secondary</Button><Button aria-pressed={selectedButton === "Outline"} variant="outline" onClick={() => setSelectedButton("Outline")}>Outline</Button><Button aria-pressed={selectedButton === "Ghost"} variant="ghost" onClick={() => setSelectedButton("Ghost")}>Ghost</Button></div><p role="status" className="mt-3 text-sm text-muted-foreground">Selected: {selectedButton}</p></Card>
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Badges</h3><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={selectedBadges.includes("Verified")} onClick={() => setSelectedBadges((items) => items.includes("Verified") ? items.filter((item) => item !== "Verified") : [...items, "Verified"])} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Badge>Verified</Badge></button><button type="button" aria-pressed={selectedBadges.includes("Popular")} onClick={() => setSelectedBadges((items) => items.includes("Popular") ? items.filter((item) => item !== "Popular") : [...items, "Popular"])} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Badge variant="secondary">Popular</Badge></button><button type="button" aria-pressed={selectedBadges.includes("New")} onClick={() => setSelectedBadges((items) => items.includes("New") ? items.filter((item) => item !== "New") : [...items, "New"])} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Badge variant="outline">New</Badge></button></div><p role="status" className="mt-3 text-sm text-muted-foreground">{selectedBadges.length ? `Active filters: ${selectedBadges.join(", ")}` : "Click a badge to filter by it."}</p></Card>
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Progress</h3><div className="flex items-center justify-center gap-4"><ProgressRing value={72} size={64} /><ProgressRing value={38} size={52} accent="success" /></div></Card>
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Avatar</h3><div className="flex items-center gap-3"><Avatar><AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330" alt="Asha" /><AvatarFallback>AS</AvatarFallback></Avatar><div><p className="font-medium">Asha Sharma</p><p className="text-sm text-muted-foreground">Instructor</p></div></div></Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Inputs & modal</h3><div className="space-y-3"><Input placeholder="Search courses" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search courses" />{search && <div aria-live="polite" className="rounded-lg border border-border p-3 text-sm">{filteredCourses.length ? filteredCourses.join(" · ") : "No matching courses"}</div>}<Input placeholder="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label="Email address" /><Button onClick={() => { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setToast("Enter a valid email address first"); return; } setOpen(true); }}>Open modal</Button></div></Card>
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Stepper</h3><Stepper steps={["Details", "Curriculum", "Publish"]} currentStep={step} onStepChange={setStep} /><p className="mt-4 text-sm text-muted-foreground">Current step: {["Details", "Curriculum", "Publish"][step]}</p></Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Tabs</h3><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="curriculum">Curriculum</TabsTrigger><TabsTrigger value="reviews">Reviews</TabsTrigger></TabsList><TabsContent value="overview" className="mt-4"><p className="text-sm text-muted-foreground">A structured learner dashboard with clear, skimmable information.</p></TabsContent><TabsContent value="curriculum" className="mt-4"><p className="text-sm text-muted-foreground">Organized modules and lesson flow for course creation.</p></TabsContent><TabsContent value="reviews" className="mt-4"><p className="text-sm text-muted-foreground">Ratings, comments, and trust indicators from students.</p></TabsContent></Tabs></Card>
          <Card className="p-5"><h3 className="mb-4 text-lg font-semibold">Skeleton + Empty state</h3><div className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-2/3" /></div><div className="mt-6"><EmptyState title="No courses yet" description="Publish your first course in a few minutes." actionLabel="Create course" onAction={() => { window.location.href = "/instructor/courses/new"; }} /></div></Card>
        </div>
        <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Toast preview</h3><Button variant="outline" size="sm" onClick={() => setToast("Course published. Your course is now live and visible to learners.")}>Show toast</Button></div>{toast ? <div role="status" aria-live="polite"><Toast title="Action complete" description={toast} /></div> : <p className="text-sm text-muted-foreground">Click a demo button to see its response here.</p>}</Card>
      </div></div>
      <Modal open={open} onOpenChange={setOpen} title="Course publishing" description="Review the publishing demo before confirming."><div className="space-y-4"><p className="text-sm text-muted-foreground">This design page demonstrates a publishing confirmation flow. No course will be published.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { setOpen(false); setToast("Publishing demo confirmed for " + email); }}>Confirm</Button></div></div></Modal>
    </main>
  );
}

