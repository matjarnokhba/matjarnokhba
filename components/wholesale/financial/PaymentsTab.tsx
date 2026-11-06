"use client";
import { CreditCard } from "lucide-react";
import { Empty } from "@/components/ui/Empty";
import type { PaymentListItem } from "./types";
export function PaymentsTab(_p: {
  businessUnitId: number;
  payments: PaymentListItem[];
  pagination: { page: number; total: number; totalPages: number };
}) {
  return (
    <Empty
      icon={CreditCard}
      title="قيد الإنشاء"
      description="سيتم تفعيل عرض المدفوعات في المرحلة القادمة."
    />
  );
}