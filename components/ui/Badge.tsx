import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";

const variants = {
  gray: "bg-gray-100 text-gray-700",
  orange: "bg-orange-100 text-orange-700",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-amber-100 text-amber-800",
  purple: "bg-purple-100 text-purple-700",
  cyan: "bg-cyan-100 text-cyan-700",
} as const;

const sizes = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
} as const;

export type BadgeVariant = keyof typeof variants;

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: keyof typeof sizes;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({
  variant = "gray",
  size = "sm",
  dot = false,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "green" && "bg-emerald-500",
            variant === "red" && "bg-red-500",
            variant === "yellow" && "bg-amber-500",
            variant === "blue" && "bg-blue-500",
            variant === "orange" && "bg-orange-500",
            variant === "purple" && "bg-purple-500",
            variant === "cyan" && "bg-cyan-500",
            variant === "gray" && "bg-gray-500"
          )}
        />
      )}
      {children}
    </span>
  );
}

// Map wholesale statuses to badge variants
export const OFFER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  DRAFT: "gray",
  PENDING_REVIEW: "yellow",
  ACTIVE: "green",
  PAUSED: "orange",
  REJECTED: "red",
  OUT_OF_STOCK: "gray",
  SUSPENDED: "red",
  ARCHIVED: "gray",
};

export const OFFER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "مسودة",
  PENDING_REVIEW: "بانتظار المراجعة",
  ACTIVE: "نشط",
  PAUSED: "موقوف مؤقتًا",
  REJECTED: "مرفوض",
  OUT_OF_STOCK: "نفد المخزون",
  SUSPENDED: "موقوف إداريًا",
  ARCHIVED: "مؤرشف",
};

export const ORDER_STATUS_VARIANT: Record<string, BadgeVariant> = {
  PENDING: "yellow",
  CONFIRMED: "blue",
  PROCESSING: "orange",
  READY: "cyan",
  SHIPPED: "blue",
  DELIVERED: "green",
  CANCELLED: "red",
  RETURNED: "gray",
  DISPUTED: "red",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار التأكيد",
  CONFIRMED: "مؤكد",
  PROCESSING: "قيد التجهيز",
  READY: "جاهز للشحن",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  RETURNED: "مرتجع",
  DISPUTED: "نزاع",
};

export const RETURN_STATUS_VARIANT: Record<string, BadgeVariant> = {
  REQUESTED: "yellow",
  APPROVED: "blue",
  REJECTED: "red",
  PENDING_SHIPMENT: "orange",
  RECEIVED: "cyan",
  INSPECTED: "purple",
  PARTIALLY_ACCEPTED: "orange",
  COMPLETED: "green",
  CANCELLED: "gray",
};

export const RETURN_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "طلب جديد",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  PENDING_SHIPMENT: "بانتظار الشحن",
  RECEIVED: "تم الاستلام",
  INSPECTED: "تم الفحص",
  PARTIALLY_ACCEPTED: "مقبول جزئيًا",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};