"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <Card className="w-full max-w-md space-y-4 p-7 text-center">
        <h1 className="text-2xl font-bold">This page couldn’t load</h1>
        <p className="text-sm text-muted-foreground">Please try again in a moment.</p>
        <Button onClick={() => reset()}>Try again</Button>
      </Card>
    </main>
  );
}
