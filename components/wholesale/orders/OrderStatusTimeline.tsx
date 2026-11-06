"use client";

import { Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { ORDER_STEPS, getOrderStepIndex } from "./types";

export interface OrderStatusTimelineProps {
  status: string;
  compact?: boolean;
}

export function OrderStatusTimeline({
  status,
  compact = false,
}: OrderStatusTimelineProps) {
  const currentIdx = getOrderStepIndex(status);

  if (
    status === "CANCELLED" ||
    status === "RETURNED" ||
    status === "DISPUTED"
  ) {
    const labelMap: Record<string, string> = {
      CANCELLED: "ملغى",
      RETURNED: "مرتجع",
      DISPUTED: "نزاع",
    };
    const Icon = status === "DISPUTED" ? AlertCircle : X;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        <Icon className="h-4 w-4 flex-shrink-0 text-red-600" />
        <span className="font-medium">
          الطلب {labelMap[status] ?? status}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", compact ? "text-[10px]" : "text-xs")}>
      {ORDER_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step.key} className="flex flex-1 items-center gap-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex flex-shrink-0 items-center justify-center rounded-full font-bold",
                  compact ? "h-5 w-5" : "h-6 w-6",
                  isCompleted
                    ? "bg-emerald-500 text-white"
                    : isCurrent
                    ? "bg-[#ff5c00] text-white"
                    : "bg-gray-200 text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
                ) : (
                  <span className={compact ? "text-[9px]" : "text-xs"}>
                    {idx + 1}
                  </span>
                )}
              </div>
              {!compact && (
                <span
                  className={cn(
                    "whitespace-nowrap text-center",
                    isCurrent
                      ? "font-semibold text-gray-900"
                      : isCompleted
                      ? "text-gray-700"
                      : "text-gray-400"
                  )}
                >
                  {step.label}
                </span>
              )}
            </div>
            {idx < ORDER_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded",
                  idx < currentIdx ? "bg-emerald-500" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}