import * as React from "react";

import { cn } from "@/lib/utils";

export function Avatar({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted", className)} {...props} />;
}

export function AvatarImage({ className, alt = "", ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />;
}

export function AvatarFallback({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("flex h-full w-full items-center justify-center text-xs font-semibold text-foreground", className)} {...props} />;
}
