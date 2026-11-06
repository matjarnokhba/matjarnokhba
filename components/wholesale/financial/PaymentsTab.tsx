"use client";

import Link from "next/link";
import { CreditCard, ChevronRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import {
  PAYMENT_METHOD_LABEL,
  formatDate,
  formatMoney,
  type PaymentListItem,
} from "./types";

export interface PaymentsTabProps {
  businessUnitId: number;
  payments: PaymentListItem[];
  pagination: { page: number; total: number; totalPages: number };
}

const STATUS_VARIANT: Record<string, "green" | "red" | "yellow" | "gray"> = {
  CONFIRMED: "green",
  PENDING: "yellow",
  REJECTED: "red",
  REFUNDED: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "مؤكدة",
  PENDING: "معلقة",
  REJECTED: "مرفوضة",
  REFUNDED: "مستردة",
};

export function PaymentsTab({ businessUnitId, payments }: PaymentsTabProps) {
  if (payments.length === 0) {
    return (
      <Empty
        icon={CreditCard}
        title="لا توجد مدفوعات"
        description="ستظهر هنا المدفوعات الصادرة والواردة بينك وبين التجار."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500">
        {payments.length} دفعة
      </div>
      {payments.map((p) => {
        const isOutgoing = p.businessUnitId === businessUnitId;
        return (
          <Link key={p.id} href={`/wholesale/payments/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 font-mono text-sm font-bold text-gray-900">
                      {isOutgoing ? (
                        <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                      {p.paymentNumber}
                    </span>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "gray"} size="sm">
                      {STATUS_LABEL[p.status] ?? p.status}
                    </Badge>
                    <Badge variant={isOutgoing ? "orange" : "green"} size="sm">
                      {isOutgoing ? "صادرة" : "واردة"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {PAYMENT_METHOD_LABEL[p.method] ?? p.method} ·{" "}
                    {formatDate(p.paidAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p
                    className={`text-lg font-black ${
                      isOutgoing ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {isOutgoing ? "−" : "+"}
                    {formatMoney(p.amount)} د.م
                  </p>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}