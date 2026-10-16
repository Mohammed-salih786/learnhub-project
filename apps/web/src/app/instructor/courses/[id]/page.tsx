import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const lessonRows = [
  { title: "Positioning your learning goals", duration: "08:52", status: "Published" },
  { title: "Research interviews that uncover signals", duration: "12:41", status: "Draft" },
  { title: "Turning experiments into business outcomes", duration: "13:08", status: "Published" }
];

export default function CourseStudioPage({ params }: { params: { id: string } }) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Course studio</p>
            <h1 className="mt-2 text-3xl font-black">Product Design Foundations</h1>
            <p className="mt-2 text-sm text-muted-foreground">Course ID: {params.id}</p>
          </div>
          <div className="flex gap-2">
            <a href="/instructor/courses/new" className={buttonVariants({ variant: "outline" })}>
              Preview
            </a>
            <a href="/instructor/courses/new" className={buttonVariants({ variant: "default" })}>
              Publish
            </a>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Learners</p>
            <p className="mt-2 text-3xl font-black">248</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Completion</p>
            <p className="mt-2 text-3xl font-black">84%</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Avg. rating</p>
            <p className="mt-2 text-3xl font-black">4.9</p>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">Lessons</h2>
            <div className="space-y-3">
              {lessonRows.map((lesson) => (
                <div key={lesson.title} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                  <div>
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-sm text-muted-foreground">{lesson.duration}</p>
                  </div>
                  <Badge variant={lesson.status === "Published" ? "default" : "secondary"}>{lesson.status}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">Quick actions</h2>
            <div className="space-y-3">
              <a href="/instructor/courses/new" className={`${buttonVariants({ variant: "default" })} w-full`}>
                  Add new lesson
              </a>
              <a href="/instructor/courses/new" className={`${buttonVariants({ variant: "outline" })} w-full`}>
                Upload thumbnail
              </a>
              <a href="/instructor/courses/new" className={`${buttonVariants({ variant: "outline" })} w-full`}>
                Set price & access
              </a>
            </div>
          </Card>
        </div>
      </main>
    </PublicShell>
  );
}
