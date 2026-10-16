import * as React from "react";

export function Toast({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
