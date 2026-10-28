import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const lessonVideos: Record<string, string> = {
  "product-design-foundations": "LckQ4VVjHDs",
  "research-ops-for-product-teams": "ODpB9-MCa5s",
  "prompt-engineering-for-daily-work": "GifUqgksJWc"
};

export default function StudentLessonPage({ params }: { params: { id: string } }) {
  const videoId = lessonVideos[params.id];

  return (
    <PublicShell>
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Lesson</p>
            <h1 className="mt-2 text-3xl font-black">{params.id.replace(/-/g, " ")}</h1>
          </div>
          <div className="flex gap-2">
            <a href="/student/courses" className={buttonVariants({ variant: "outline" })}>
              Course catalog
            </a>
            <a href="/student" className={buttonVariants({ variant: "default" })}>
              Continue learning
            </a>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="aspect-video bg-black">
            {videoId ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}`}
                title={`${params.id.replace(/-/g, " ")} lesson video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-background text-xl font-bold text-foreground">
                Lesson preview player
              </div>
            )}
          </div>
          <div className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">Lesson overview</p>
                <p className="text-sm text-muted-foreground">Built to help real-world learners apply ideas quickly.</p>
              </div>
              <Badge>12 min</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="mt-2 text-2xl font-black">68%</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="mt-2 text-2xl font-black">2/4</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Access</p>
                <p className="mt-2 text-2xl font-black">Premium</p>
              </Card>
            </div>
          </div>
        </Card>
      </main>
    </PublicShell>
  );
}
