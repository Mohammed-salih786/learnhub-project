import { StudentShell } from "@/components/layout/student-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const learningTracks = [
  { title: "Product design foundations", progress: 68, lessons: "4 of 11 lessons" },
  { title: "AI workflows for operations", progress: 42, lessons: "6 of 15 lessons" },
  { title: "Research sprint playbooks", progress: 81, lessons: "9 of 12 lessons" }
];

export default function StudentPage() {
  return (
    <StudentShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Student dashboard</p>
            <h1 className="mt-2 text-3xl font-black">Your learning space</h1>
          </div>
          <div className="flex gap-2">
            <a href="/student/courses" className={buttonVariants({ variant: "outline" })}>
              Explore catalog
            </a>
            <a href="/student/checkout" className={buttonVariants({ variant: "default" })}>
              Continue learning
            </a>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Courses in progress</p>
            <p className="mt-2 text-3xl font-black">12</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Certificates earned</p>
            <p className="mt-2 text-3xl font-black">3</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Learning streak</p>
            <p className="mt-2 text-3xl font-black">18 days</p>
          </Card>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Continue learning</h2>
              <Badge>Updated today</Badge>
            </div>

            <div className="space-y-4">
              {learningTracks.map((track) => (
                <div key={track.title} className="rounded-xl border border-border bg-muted/40 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{track.title}</p>
                    <span className="text-sm font-medium text-foreground">{track.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-background">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${track.progress}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{track.lessons}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold">Quick actions</h2>
            <div className="mt-5 space-y-3">
              <a href="/student/courses" className={`${buttonVariants({ variant: "default" })} w-full`}>
                Browse catalog
              </a>
              <a href="/student/courses/product-design-foundations" className={`${buttonVariants({ variant: "outline" })} w-full`}>
                Resume latest course
              </a>
              <a href="/student/checkout" className={`${buttonVariants({ variant: "outline" })} w-full`}>
                Review plans
              </a>
            </div>
          </Card>
        </div>
      </main>
    </StudentShell>
  );
}
