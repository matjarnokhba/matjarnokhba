import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
} as const;

const shadowClasses = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof paddingClasses;
  shadow?: keyof typeof shadowClasses;
  border?: boolean;
}

export function Card({
  padding = "md",
  shadow = "sm",
  border = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white",
        paddingClasses[padding],
        shadowClasses[shadow],
        border && "border border-gray-200",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}