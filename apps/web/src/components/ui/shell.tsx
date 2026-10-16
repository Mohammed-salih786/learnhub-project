import * as React from "react";

import { cn } from "@/lib/utils";

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{title}</h2>
      {children}
    </div>
  );
}
