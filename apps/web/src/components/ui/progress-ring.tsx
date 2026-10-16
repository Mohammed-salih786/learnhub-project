import * as React from "react";

import { cn } from "@/lib/utils";

export function ProgressRing({ value, size = 64, accent = "primary" }: { value: number; size?: number; accent?: "primary" | "success" }) {
  const stroke = accent === "success" ? "#22c55e" : "#2563eb";
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(148,163,184,0.25)" strokeWidth="6" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className={cn("absolute text-xs font-bold", accent === "success" ? "text-emerald-600" : "text-primary")}>
        {value}%
      </span>
    </div>
  );
}
