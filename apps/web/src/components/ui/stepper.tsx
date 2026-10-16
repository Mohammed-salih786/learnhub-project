import * as React from "react";

import { cn } from "@/lib/utils";

export function Stepper({ steps, currentStep, onStepChange }: { steps: string[]; currentStep: number; onStepChange?: (step: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const active = index <= currentStep;
        return (
          <React.Fragment key={step}>
            {onStepChange ? (
              <button type="button" aria-label={`Go to ${step}`} aria-current={index === currentStep ? "step" : undefined} onClick={() => onStepChange(index)} className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {index + 1}
              </button>
            ) : (
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {index + 1}
              </div>
            )}
            {index < steps.length - 1 ? <div className={cn("h-px flex-1", active ? "bg-primary" : "bg-muted")} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
