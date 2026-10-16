import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const pricing = [
  { key: "trial", label: "Free Trial", price: 0, description: "7 days + 2 free courses + limited test attempts", highlight: false },
  { key: "monthly", label: "Monthly", price: 149, description: "Full course access with flexible monthly billing", highlight: true },
  { key: "yearly", label: "Yearly", price: 999, description: "Best value + certificates + priority support", highlight: false }
] as const;

export default function HomePage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <section className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            <Badge className="mb-4">India-first learning marketplace</Badge>
            <h1 className="max-w-xl text-4xl font-black tracking-tight sm:text-5xl">
              Learn smarter with a subscription that never limits growth.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              LearnHub helps students discover practical, outcome-driven courses while giving instructors a simple, trustworthy way to publish and sell.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/design">Explore courses</Link>
              </Button>
              <Button variant="outline" asChild size="lg">
                <Link href="/instructor">Become an instructor</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-8 text-sm text-muted-foreground">
              <div><span className="font-bold text-foreground">15k+</span> active learners</div>
              <div><span className="font-bold text-foreground">850+</span> verified courses</div>
              <div><span className="font-bold text-foreground">4.8/5</span> learner rating</div>
            </div>
          </div>

          <Card className="p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Growth snapshot</p>
              <Badge>Live</Badge>
            </div>
            <div className="mt-8 space-y-6">
              <div>
                <p className="text-3xl font-black">₹149</p>
                <p className="text-sm text-muted-foreground">Monthly access</p>
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2"><span>Full library</span><span>Included</span></div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2"><span>Certificates</span><span>Yearly</span></div>
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2"><span>Priority support</span><span>Yearly</span></div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mt-16">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">Simple plans, no complexity</h2>
            <Badge variant="secondary">GST inclusive</Badge>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {pricing.map((plan) => (
              <Card key={plan.key} className={plan.highlight ? "border-primary bg-primary/5" : ""}>
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold">{plan.label}</h3>
                    {plan.highlight ? <Badge>Most popular</Badge> : null}
                  </div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-4xl font-black">₹{plan.price}</span>
                    {plan.price > 0 ? <span className="text-sm text-muted-foreground">/month</span> : <span className="text-sm text-muted-foreground">/7 days</span>}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
                  <Button className="mt-6 w-full" variant={plan.highlight ? "default" : "outline"} asChild>
                    <Link href="/student">Choose {plan.label}</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { title: "Trust from day one", body: "Instructor credibility and verified badges are surfaced before checkout." },
            { title: "Built for mobile", body: "Designed around 360px-first usage with a responsive, low-friction learner experience." },
            { title: "Analytics ready", body: "Every meaningful action is instrumented for conversion, retention, and growth decisions." }
          ].map((item) => (
            <Card key={item.title} className="p-6">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
            </Card>
          ))}
        </section>
      </main>
    </PublicShell>
  );
}
