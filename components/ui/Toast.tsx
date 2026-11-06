"use client";

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast, type ToastVariant } from "@/lib/hooks/useToast";
import { cn } from "@/lib/ui/cn";

const icons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

const iconColors: Record<ToastVariant, string> = {
  success: "text-emerald-600",
  error: "text-red-600",
  warning: "text-amber-600",
  info: "text-blue-600",
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 space-y-2 px-4 sm:left-4 sm:translate-x-0"
      dir="rtl"
    >
      {toasts.map((t) => {
        const Icon = icons[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 shadow-md",
              styles[t.variant]
            )}
          >
            <Icon
              className={cn("mt-0.5 h-5 w-5 flex-shrink-0", iconColors[t.variant])}
            />
            <p className="flex-1 text-sm font-medium">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}