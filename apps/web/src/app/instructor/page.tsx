import { InstructorShell } from "@/components/layout/instructor-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const recentCourses = [
  { title: "Product Design Foundations", learners: 248, status: "Published" },
  { title: "Revenue Systems for Solo Builders", learners: 96, status: "Draft" },
  { title: "AI Workflow Playbooks", learners: 143, status: "Needs review" }
];

export default function InstructorPage() {
  return (
    <InstructorShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Instructor dashboard</p>
            <h1 className="mt-2 text-3xl font-black">Teach and grow</h1>
          </div>
          <div className="flex gap-2">
            <a href="/instructor/courses" className={buttonVariants({ variant: "outline" })}>
              View courses
            </a>
            <a href="/instructor/courses/new" className={buttonVariants({ variant: "default" })}>
              Create course
            </a>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Active courses</p>
            <p className="mt-2 text-3xl font-black">8</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Avg. rating</p>
            <p className="mt-2 text-3xl font-black">4.9</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Earnings estimate</p>
            <p className="mt-2 text-3xl font-black">₹18.4k</p>
          </Card>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent work</h2>
              <a href="/instructor/courses" className="text-sm text-primary">
                View all
              </a>
            </div>
            <div className="space-y-4">
              {recentCourses.map((course) => (
                <div key={course.title} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                  <div>
                    <p className="font-medium">{course.title}</p>
                    <p className="text-sm text-muted-foreground">{course.learners} learners</p>
                  </div>
                  <Badge variant={course.status === "Published" ? "default" : course.status === "Draft" ? "secondary" : "outline"}>
                    {course.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold">Content workflow</h2>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                1. Draft your curriculum and define outcomes.
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                2. Upload lesson videos and supporting material.
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                3. Submit for review and publish when ready.
              </div>
            </div>
          </Card>
        </div>
      </main>
    </InstructorShell>
  );
}
