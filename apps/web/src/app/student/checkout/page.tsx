import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/layout/public-shell";

const plans = [
  { name: "Free trial", price: "₹0", detail: "7 days + 2 free courses" },
  { name: "Monthly", price: "₹149", detail: "Full access for one month" },
  { name: "Yearly", price: "₹999", detail: "Best value for long-term learners" }
];

export default function StudentCheckoutPage() {
  return (
    <PublicShell>
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Plans</p>
          <h1 className="mt-2 text-3xl font-black">Choose the right access level</h1>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">{plan.name}</h2>
                {plan.name === "Monthly" ? <Badge>Most popular</Badge> : null}
              </div>
              <p className="text-4xl font-black">{plan.price}</p>
              <p className="mt-3 text-sm text-muted-foreground">{plan.detail}</p>
              <a href="/student/courses" className={`${buttonVariants({ variant: plan.name === "Monthly" ? "default" : "outline" })} mt-6 w-full`}>
                Select plan
              </a>
            </Card>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
