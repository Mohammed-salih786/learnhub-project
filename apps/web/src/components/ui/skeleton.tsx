import * as React from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-shimmer rounded-xl bg-[linear-gradient(90deg,hsl(var(--muted))_25%,hsl(var(--secondary))_50%,hsl(var(--muted))_75%)] bg-[length:200%_100%]", className)} {...props} />;
}
