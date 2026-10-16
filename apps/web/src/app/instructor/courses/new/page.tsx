import { CourseForm } from "@/components/instructor/course-form";
import { PublicShell } from "@/components/layout/public-shell";

export default function NewCoursePage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Create course</p>
          <h1 className="mt-2 text-3xl font-black">Design a new learning experience</h1>
        </div>
        <CourseForm />
      </main>
    </PublicShell>
  );
}
