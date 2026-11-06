"use client";

import Link from "next/link";
import { Receipt, ArrowLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import {
  INVOICE_TYPE_LABEL,
  INVOICE_TYPE_VARIANT,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
  formatDate,
  formatMoney,
  type InvoiceListItem,
} from "./types";

export interface InvoicesTabProps {
  businessUnitId: number;
  invoices: InvoiceListItem[];
  pagination: { page: number; total: number; totalPages: number };
}

export function InvoicesTab({ invoices }: InvoicesTabProps) {
  if (invoices.length === 0) {
    return (
      <Empty
        icon={Receipt}
        title="لا توجد فواتير"
        description="ستظهر هنا فواتير البيع والشراء عند استلام/شحن الطلبات."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500">
        {invoices.length} فاتورة
      </div>
      {invoices.map((inv) => {
        const remaining = inv.total - inv.paidAmount;
        return (
          <Link key={inv.id} href={`/wholesale/invoices/${inv.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-900">
                      {inv.invoiceNumber}
                    </span>
                    <Badge
                      variant={INVOICE_TYPE_VARIANT[inv.invoiceType] ?? "gray"}
                      size="sm"
                    >
                      {INVOICE_TYPE_LABEL[inv.invoiceType] ?? inv.invoiceType}
                    </Badge>
                    <Badge
                      variant={INVOICE_STATUS_VARIANT[inv.status] ?? "gray"}
                      size="sm"
                    >
                      {INVOICE_STATUS_LABEL[inv.status] ?? inv.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(inv.issuedAt)}
                    {inv.orderId && ` · طلب #${inv.orderId}`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-lg font-black text-gray-900">
                      {formatMoney(inv.total)} د.م
                    </p>
                    {remaining > 0.01 && (
                      <p className="text-xs text-amber-600">
                        متبقي: {formatMoney(remaining)}
                      </p>
                    )}
                    {inv.paidAmount > 0 && remaining <= 0.01 && (
                      <p className="text-xs text-emerald-600">
                        مدفوعة بالكامل
                      </p>
                    )}
                  </div>
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