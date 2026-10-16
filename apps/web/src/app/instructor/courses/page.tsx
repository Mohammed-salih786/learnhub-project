import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const courseRows = [
  {
    id: "pr-101",
    title: "Product Design Foundations",
    status: "Published",
    students: 248,
    rating: 4.9,
    revenue: "₹38,400"
  },
  {
    id: "pr-102",
    title: "Research Ops for Product Teams",
    status: "Draft",
    students: 0,
    rating: "-",
    revenue: "₹0"
  },
  {
    id: "pr-103",
    title: "Growth Experiments in SaaS",
    status: "Needs review",
    students: 58,
    rating: 4.8,
    revenue: "₹12,200"
  }
];

export default function InstructorCoursesPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Course Studio</p>
            <h1 className="mt-2 text-3xl font-black">Manage your catalog</h1>
          </div>
          <a href="/instructor/courses/new" className={buttonVariants({ variant: "default" })}>
            New course
          </a>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Published</p>
            <p className="mt-2 text-3xl font-black">12</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Drafts</p>
            <p className="mt-2 text-3xl font-black">4</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="mt-2 text-3xl font-black">₹1.3L</p>
          </Card>
        </div>

        <div className="space-y-4">
          {courseRows.map((course) => (
            <Card key={course.id} className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="text-xl font-bold">{course.title}</h2>
                    <Badge variant={course.status === "Published" ? "default" : course.status === "Draft" ? "secondary" : "outline"}>
                      {course.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{course.students} learners</span>
                    <span>Rating {course.rating}</span>
                    <span>Revenue {course.revenue}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <a href={`/instructor/courses/${course.id}`} className={buttonVariants({ variant: "outline" })}>
                    Open studio
                  </a>
                  <a href="/instructor/courses/new" className={buttonVariants({ variant: "default" })}>
                    Edit
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
