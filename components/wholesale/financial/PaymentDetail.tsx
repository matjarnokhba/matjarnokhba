"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Receipt,
  RotateCcw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  PAYMENT_METHOD_LABEL,
  INVOICE_TYPE_LABEL,
  INVOICE_TYPE_VARIANT,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
  BU_TYPE_LABEL,
  formatDateTime,
  formatMoney,
  type PaymentDetail as PaymentDetailType,
} from "./types";

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

export interface PaymentDetailProps {
  payment: PaymentDetailType & {
    businessUnit: { id: number; name: string; type: string } | null;
    counterparty: { id: number; name: string; type: string } | null;
  };
}

export function PaymentDetail({ payment }: PaymentDetailProps) {
  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/financial?tab=payments"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للمدفوعات
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-400" />
            <span className="font-mono">{payment.paymentNumber}</span>
            <Badge variant={STATUS_VARIANT[payment.status] ?? "gray"}>
              {STATUS_LABEL[payment.status] ?? payment.status}
            </Badge>
          </span>
        }
        description={`${PAYMENT_METHOD_LABEL[payment.method] ?? payment.method} · ${formatDateTime(payment.paidAt)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Parties */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              الأطراف
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-red-50 p-3">
                <p className="flex items-center gap-1 text-xs text-red-700">
                  <ArrowUpRight className="h-3 w-3" />
                  دافع
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {payment.businessUnit?.name ?? "—"}
                </p>
                {payment.businessUnit && (
                  <p className="text-xs text-gray-500">
                    {BU_TYPE_LABEL[payment.businessUnit.type] ??
                      payment.businessUnit.type}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="flex items-center gap-1 text-xs text-emerald-700">
                  <ArrowDownRight className="h-3 w-3" />
                  مستلم
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {payment.counterparty?.name ?? "—"}
                </p>
                {payment.counterparty && (
                  <p className="text-xs text-gray-500">
                    {BU_TYPE_LABEL[payment.counterparty.type] ??
                      payment.counterparty.type}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Summary */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              ملخص الدفعة
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">المبلغ الكلي</dt>
                <dd className="text-lg font-black text-gray-900">
                  {formatMoney(payment.summary.total)} د.م
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">المخصص</dt>
                <dd className="font-medium text-blue-600">
                  {formatMoney(payment.summary.allocated)} د.م
                </dd>
              </div>
              {payment.summary.refunded > 0.01 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">المسترد</dt>
                  <dd className="font-medium text-red-600">
                    {formatMoney(payment.summary.refunded)} د.م
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="text-gray-600">المتبقي</dt>
                <dd className="font-bold text-amber-600">
                  {formatMoney(payment.summary.remaining)} د.م
                </dd>
              </div>
            </dl>
          </Card>

          {/* Allocations */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Receipt className="h-4 w-4 text-gray-400" />
              الفواتير ({payment.allocations.length})
            </h3>
            {payment.allocations.length === 0 ? (
              <p className="text-sm text-gray-500">
                لا توجد فواتير مخصصة لهذه الدفعة بعد.
              </p>
            ) : (
              <div className="space-y-2">
                {payment.allocations.map((a) => (
                  <Link
                    key={a.id}
                    href={`/wholesale/invoices/${a.invoice.id}`}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="font-mono text-xs font-bold text-gray-900">
                          {a.invoice.invoiceNumber}
                        </span>
                        <Badge
                          variant={
                            INVOICE_TYPE_VARIANT[a.invoice.invoiceType] ?? "gray"
                          }
                          size="sm"
                        >
                          {INVOICE_TYPE_LABEL[a.invoice.invoiceType] ??
                            a.invoice.invoiceType}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        من {formatMoney(a.invoice.total)} د.م
                      </p>
                    </div>
                    <p className="font-bold text-blue-600">
                      {formatMoney(a.allocatedAmount)} د.م
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Refunds */}
          {payment.refunds.length > 0 && (
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <RotateCcw className="h-4 w-4 text-gray-400" />
                الاستردادات ({payment.refunds.length})
              </h3>
              <div className="space-y-2">
                {payment.refunds.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg bg-red-50 p-3"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-red-900">
                        {r.refundNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.reason || "—"} ·{" "}
                        {r.processedAt ? formatDateTime(r.processedAt) : "—"}
                      </p>
                    </div>
                    <p className="font-bold text-red-700">
                      −{formatMoney(r.amount)} د.م
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {payment.notes && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                ملاحظات
              </h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {payment.notes}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {payment.settlement && (
            <Card className="border-blue-200">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900">
                <Wallet className="h-4 w-4" />
                تسوية
              </h3>
              <p className="text-lg font-black text-blue-700">
                {formatMoney(payment.settlement.amount)} د.م
              </p>
              <Badge variant="blue" size="sm">
                {payment.settlement.status}
              </Badge>
              {payment.settlement.settledAt && (
                <p className="mt-2 text-xs text-gray-500">
                  {formatDateTime(payment.settlement.settledAt)}
                </p>
              )}
            </Card>
          )}

          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              معلومات الدفع
            </h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-gray-500">الطريقة</dt>
                <dd className="text-gray-900">
                  {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">العملة</dt>
                <dd className="text-gray-900">{payment.currency}</dd>
              </div>
              <div>
                <dt className="text-gray-500">التاريخ</dt>
                <dd className="text-gray-900">
                  {formatDateTime(payment.paidAt)}
                </dd>
              </div>
              {payment.groupId && (
                <div>
                  <dt className="text-gray-500">مجموعة الدفع</dt>
                  <dd className="font-mono text-gray-900">
                    #{payment.groupId}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {payment.summary.remaining > 0.01 && (
            <Card className="border-amber-200 bg-amber-50">
              <p className="flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                يوجد مبلغ متبقٍ ({formatMoney(payment.summary.remaining)} د.م)
                يمكن تخصيصه لفواتير مستقبلية.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}