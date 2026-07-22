import React from "react";
import { STATUSES } from "@/lib/constants";
import { Check } from "lucide-react";

export default function WorkflowStepper({ current }) {
  const idx = Math.max(0, STATUSES.findIndex((s) => s.id === current));
  return (
    <div data-testid="workflow-stepper" className="flex items-center gap-2 w-full overflow-x-auto py-2">
      {STATUSES.map((s, i) => {
        const isDone = i < idx;
        const isCurrent = i === idx;
        return (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-2 shrink-0">
              <div
                className={[
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold border",
                  isCurrent ? "bg-primary text-primary-foreground border-primary"
                    : isDone ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-muted text-muted-foreground border-border",
                ].join(" ")}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
            {i < STATUSES.length - 1 && (
              <div className={`h-px flex-1 min-w-[16px] ${i < idx ? "bg-emerald-500" : "bg-border"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
