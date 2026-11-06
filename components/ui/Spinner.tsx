import { Loader2 } from "lucide-react";
import { cn } from "@/lib/ui/cn";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
} as const;

export interface SpinnerProps {
  size?: keyof typeof sizeClasses;
  className?: string;
  label?: string;
}

export function Spinner({ size = "md", className, label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? "جارٍ التحميل"}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <Loader2 className={cn("animate-spin text-[#ff5c00]", sizeClasses[size])} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </span>
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}