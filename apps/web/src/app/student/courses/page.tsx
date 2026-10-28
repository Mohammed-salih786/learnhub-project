import { CourseCard } from "@/components/student/course-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const catalog = [
  {
    title: "Product Design Foundations",
    category: "Design",
    level: "Beginner",
    learners: 248,
    price: "₹299/mo",
    isPremium: true,
    image: "/course-images/minimal-3d-ui-design-workspace.png",
    href: "/student/courses/product-design-foundations"
  },
  {
    title: "Research Ops for Product Teams",
    category: "Product",
    level: "Intermediate",
    learners: 186,
    price: "₹499/mo",
    isPremium: true,
    image: "/course-images/pastel-product-research-dashboard.png",
    href: "/student/courses/research-ops-for-product-teams"
  },
  {
    title: "Prompt Engineering for Daily Work",
    category: "AI",
    level: "Beginner",
    learners: 412,
    price: "Free preview",
    isPremium: false,
    image: "/course-images/ai-prompting-productivity-workspace.png",
    href: "/student/courses/prompt-engineering-for-daily-work"
  }
];

export default function StudentCatalogPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Learning library</p>
            <h1 className="mt-2 text-3xl font-black">Discover your next skill</h1>
          </div>
          <div className="flex gap-2">
            <a href="/student" className={buttonVariants({ variant: "outline" })}>
              Dashboard
            </a>
            <a href="/student/checkout" className={buttonVariants({ variant: "default" })}>
              View plans
            </a>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Ongoing</p>
            <p className="mt-2 text-2xl font-black">12</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Certificates</p>
            <p className="mt-2 text-2xl font-black">3</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Streak</p>
            <p className="mt-2 text-2xl font-black">18 days</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">Plan</p>
            <p className="mt-2 text-2xl font-black">Monthly</p>
          </Card>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <Badge variant="secondary">Featured</Badge>
          <span className="text-sm text-muted-foreground">Built for working professionals and career switchers.</span>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {catalog.map((course) => (
            <CourseCard key={course.title} {...course} />
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
