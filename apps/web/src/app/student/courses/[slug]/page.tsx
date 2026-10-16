import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const lessonPlan = [
  { title: "What good product thinking looks like", duration: "08:42", preview: true },
  { title: "Research interviews that expose the real problem", duration: "12:31", preview: false },
  { title: "Designing a feedback loop for product teams", duration: "10:17", preview: false },
  { title: "Turning experiments into business outcomes", duration: "14:03", preview: false }
];

export default function StudentCourseDetailPage({ params }: { params: { slug: string } }) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Course</p>
            <h1 className="mt-2 text-3xl font-black">{params.slug.replace(/-/g, " ")}</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Build stronger product instincts, learn to run practical research loops, and translate customer insight into better decisions.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/student/courses" className={buttonVariants({ variant: "outline" })}>
              Back to catalog
            </a>
            <a href={`/student/lessons/${params.slug}`} className={buttonVariants({ variant: "default" })}>
              Start learning
            </a>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Level</p>
            <p className="mt-2 text-2xl font-black">Beginner</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="mt-2 text-2xl font-black">4h 36m</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Price</p>
            <p className="mt-2 text-2xl font-black">₹299/mo</p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">Curriculum</h2>
            <div className="space-y-3">
              {lessonPlan.map((lesson, index) => (
                <div key={lesson.title} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                  <div>
                    <p className="font-medium">
                      {index + 1}. {lesson.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{lesson.duration}</p>
                  </div>
                  {lesson.preview ? <Badge>Preview</Badge> : <Badge variant="secondary">Locked</Badge>}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">What you get</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li>• Lifetime access to course content</li>
              <li>• Downloadable resource pack</li>
              <li>• Guided exercises and capstone tasks</li>
              <li>• Certificate eligibility</li>
            </ul>
          </Card>
        </div>
      </main>
    </PublicShell>
  );
}
