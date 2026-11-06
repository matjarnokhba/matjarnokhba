"use client";
import { Receipt } from "lucide-react";
import { Empty } from "@/components/ui/Empty";
import type { InvoiceListItem } from "./types";
export function InvoicesTab(_p: {
  businessUnitId: number;
  invoices: InvoiceListItem[];
  pagination: { page: number; total: number; totalPages: number };
}) {
  return (
    <Empty
      icon={Receipt}
      title="قيد الإنشاء"
      description="سيتم تفعيل عرض الفواتير في المرحلة القادمة."
    />
  );
}