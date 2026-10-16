import { StudentShell } from "@/components/layout/student-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProgressPage() {
  return (
    <StudentShell>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">My progress</p>
          <h1 className="mt-1 text-2xl font-black">Learning activity</h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <Card className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Completed</p>
            <p className="mt-1 text-3xl font-black">0</p>
            <p className="text-xs text-muted-foreground mt-1">courses</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">In progress</p>
            <p className="mt-1 text-3xl font-black">0</p>
            <p className="text-xs text-muted-foreground mt-1">courses</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Streak</p>
            <p className="mt-1 text-3xl font-black">0</p>
            <p className="text-xs text-muted-foreground mt-1">days</p>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Course progress</h2>
            <Badge variant="secondary">0 enrolled</Badge>
          </div>
          <div className="py-12 text-center text-muted-foreground text-sm">
            <p>Enroll in courses to track your progress here.</p>
            <a href="/student/courses" className="mt-3 inline-block text-primary underline text-sm">Browse catalog →</a>
          </div>
        </Card>
      </main>
    </StudentShell>
  );
}
