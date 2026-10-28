"use client";

import { Check } from "lucide-react";
import { STEPS, type WizardStep } from "./types";

type Props = {
  current: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  completed: WizardStep[];
};

export default function WizardStepper({ current, onStepClick, completed }: Props) {
  return (
    <div className="mb-6" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, idx) => {
          const isDone = completed.includes(step.n);
          const isCurrent = current === step.n;
          const canClick = onStepClick && (isDone || step.n < current);

          return (
            <div key={step.n} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => canClick && onStepClick?.(step.n)}
                disabled={!canClick}
                className={`flex flex-col items-center gap-1.5 ${
                  canClick ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black transition ${
                    isDone
                      ? "bg-green-600 text-white"
                      : isCurrent
                        ? "bg-[#ff5c00] text-white shadow-md ring-4 ring-orange-100"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isDone ? <Check className="h-4 w-4" /> : step.n}
                </div>
                <span
                  className={`hidden text-[10px] font-bold sm:block ${
                    isCurrent
                      ? "text-[#ff5c00]"
                      : isDone
                        ? "text-green-700"
                        : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded-full transition ${
                    completed.includes(STEPS[idx + 1].n) || STEPS[idx + 1].n === current
                      ? "bg-green-500"
                      : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}