import { InstructorShell } from "@/components/layout/instructor-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InstructorAnalyticsPage() {
  return (
    <InstructorShell>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Instructor</p>
            <h1 className="mt-1 text-2xl font-black">Analytics</h1>
          </div>
          <Badge variant="secondary">Estimate</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <Card className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Enrollments</p>
            <p className="mt-1 text-3xl font-black">—</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg. score</p>
            <p className="mt-1 text-3xl font-black">—</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Earnings est.</p>
            <p className="mt-1 text-3xl font-black">₹0</p>
          </Card>
        </div>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Detailed analytics are available once you publish your first course and students enroll.
            All earnings figures are estimates based on watch-minute share and are labelled accordingly.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Actual payouts are processed manually by the admin team. Contact{" "}
            <a href="mailto:support@learnhub.in" className="text-primary underline">
              support@learnhub.in
            </a>{" "}
            for payout inquiries.
          </p>
        </Card>
      </main>
    </InstructorShell>
  );
}
