import { PublicShell } from "@/components/layout/public-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const metrics = [
  { label: "Total subscribers", value: "8.2k", delta: "+12.4%" },
  { label: "Active instructors", value: "214", delta: "+9 new" },
  { label: "Pending reviews", value: "18", delta: "5 urgent" },
  { label: "Revenue", value: "₹3.6L", delta: "+18.2%" }
];

const moderationQueue = [
  { course: "AI Workflow Playbooks", reviewer: "Ananya Shah", reason: "Misleading outcomes language in landing page", severity: "high" },
  { course: "Beginner Video Editing", reviewer: "Rahul Nair", reason: "Inconsistent pricing and refund policy", severity: "medium" },
  { course: "Career Sprint Bootcamp", reviewer: "Mira Patel", reason: "Support links missing from learner onboarding", severity: "low" }
];

const analyticsData = [
  { label: "Trial-to-paid conversion", value: "4.8%" },
  { label: "Monthly churn", value: "2.1%" },
  { label: "Course completion", value: "78%" },
  { label: "Support backlog", value: "34 tickets" }
];

const adminSections = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/instructors", label: "Instructor verification" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/moderation", label: "Moderation queue" },
  { href: "/admin/audit-logs", label: "Audit log" }
];

export default function AdminPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Admin console</p>
            <h1 className="mt-2 text-3xl font-black">Marketplace control room</h1>
          </div>
          <div className="flex gap-2">
            <a href="/admin/courses" className={buttonVariants({ variant: "outline" })}>
              Course approvals
            </a>
            <a href="/admin" className={buttonVariants({ variant: "outline" })}>
              Review reports
            </a>
            <a href="/design" className={buttonVariants({ variant: "default" })}>
              Export insights
            </a>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.label} className="p-5">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-3xl font-black">{metric.value}</p>
              <p className="mt-2 text-xs font-medium text-emerald-600">{metric.delta}</p>
            </Card>
          ))}
        </div>

        <nav aria-label="Admin tools" className="mt-6 flex flex-wrap gap-2">
          {adminSections.map((section) => (
            <a key={section.href} href={section.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {section.label}
            </a>
          ))}
        </nav>

        <Tabs defaultValue="overview" className="mt-10">
          <TabsList className="mb-6 w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-bold">Activation and retention</h2>
                <div className="space-y-5">
                  {[65, 78, 92, 70].map((value, index) => (
                    <div key={index}>
                      <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                        <span>{["New signups", "Course starts", "Instructor activation", "Repeat purchases"][index]}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-background">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="mb-4 text-xl font-bold">Operational snapshot</h2>
                <div className="space-y-4">
                  {analyticsData.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="moderation">
            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Moderation queue</h2>
                <Badge>18 pending</Badge>
              </div>

              <div className="space-y-4">
                {moderationQueue.map((item) => (
                  <div key={item.course} className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto] md:items-center">
                    <div>
                      <p className="font-semibold">{item.course}</p>
                      <p className="text-sm text-muted-foreground">Reviewer: {item.reviewer}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.reason}</p>
                    <Badge variant={item.severity === "high" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"}>{item.severity}</Badge>
                    <div className="flex gap-2">
                      <a href="/admin" className={buttonVariants({ variant: "outline" })}>Review</a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payouts">
            <Card className="p-6">
              <h2 className="mb-3 text-xl font-bold">Payout tracker</h2>
              <p className="mb-5 text-sm text-muted-foreground">Review accrued instructor earnings and record transfer references.</p>
              <a href="/admin/payouts" className={buttonVariants({ variant: "default" })}>Open payout management</a>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-6">
                <h2 className="mb-4 text-xl font-bold">Revenue mix</h2>
                <div className="space-y-4">
                  {[
                    { label: "Monthly subscriptions", value: "₹1.8L" },
                    { label: "Yearly subscriptions", value: "₹1.2L" },
                    { label: "Instructor payouts", value: "₹0.7L" }
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="mb-4 text-xl font-bold">Policy health</h2>
                <div className="space-y-4 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border bg-muted/40 p-3">Refund disputes: 6 in the last 7 days</div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3">Instructor compliance: 93% aligned</div>
                  <div className="rounded-xl border border-border bg-muted/40 p-3">Content quality issues: 3 escalated</div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </PublicShell>
  );
}
