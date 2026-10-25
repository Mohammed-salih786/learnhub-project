import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-[75vh] items-center justify-center bg-background px-4 py-12 text-foreground">
      <Card className="w-full max-w-md space-y-4 p-7 text-center">
        <p className="text-sm font-semibold text-muted-foreground">404</p>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-muted-foreground">That link may be outdated. Return to LearnHub and continue from there.</p>
        <Button asChild><Link href="/">Go to LearnHub</Link></Button>
      </Card>
    </main>
  );
}
