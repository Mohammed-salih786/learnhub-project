import * as React from "react";

import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      {actionLabel ? (
        <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
