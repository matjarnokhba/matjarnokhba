"use client";

import Link from "next/link";
import {
  ArrowRight,
  Receipt,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  INVOICE_TYPE_LABEL,
  INVOICE_TYPE_VARIANT,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_VARIANT,
  BU_TYPE_LABEL,
  formatDateTime,
  formatMoney,
  type InvoiceDetail as InvoiceDetailType,
} from "./types";

export interface InvoiceDetailProps {
  invoice: InvoiceDetailType & {
    businessUnit: { id: number; name: string; type: string } | null;
    counterparty: { id: number; name: string; type: string } | null;
  };
}

export function InvoiceDetail({ invoice }: InvoiceDetailProps) {
  const remaining = invoice.total - invoice.paidAmount;

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/financial?tab=invoices"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للفواتير
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Receipt className="h-5 w-5 text-gray-400" />
            <span className="font-mono">{invoice.invoiceNumber}</span>
            <Badge
              variant={INVOICE_TYPE_VARIANT[invoice.invoiceType] ?? "gray"}
            >
              {INVOICE_TYPE_LABEL[invoice.invoiceType] ?? invoice.invoiceType}
            </Badge>
            <Badge variant={INVOICE_STATUS_VARIANT[invoice.status] ?? "gray"}>
              {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </Badge>
          </span>
        }
        description={`صادرة في ${formatDateTime(invoice.issuedAt)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Parties */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              الأطراف
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  {invoice.invoiceType === "SALE" ? "البائع" : "المشتري"}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {invoice.businessUnit?.name ?? "—"}
                </p>
                {invoice.businessUnit && (
                  <p className="text-xs text-gray-500">
                    {BU_TYPE_LABEL[invoice.businessUnit.type] ??
                      invoice.businessUnit.type}
                  </p>
                )}
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  {invoice.invoiceType === "SALE" ? "المشتري" : "البائع"}
                </p>
                <p className="mt-1 font-semibold text-gray-900">
                  {invoice.counterparty?.name ?? "—"}
                </p>
                {invoice.counterparty && (
                  <p className="text-xs text-gray-500">
                    {BU_TYPE_LABEL[invoice.counterparty.type] ??
                      invoice.counterparty.type}
                  </p>
                )}
              </div>
            </div>
            {invoice.orderId && (
              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">
                مرتبطة بطلب{" "}
                <Link
                  href={`/wholesale/orders/${invoice.orderId}`}
                  className="font-medium underline"
                >
                  #{invoice.orderId}
                </Link>
              </div>
            )}
          </Card>

          {/* Amounts */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              المبالغ
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">المجموع الفرعي</dt>
                <dd className="font-medium text-gray-900">
                  {formatMoney(invoice.subtotal)} د.م
                </dd>
              </div>
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">ضريبة</dt>
                  <dd className="text-gray-900">
                    {formatMoney(invoice.taxAmount)} د.م
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="font-bold text-gray-900">الإجمالي</dt>
                <dd className="text-lg font-black text-[#ff5c00]">
                  {formatMoney(invoice.total)} د.م
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">مدفوع</dt>
                <dd className="font-medium text-emerald-600">
                  {formatMoney(invoice.paidAmount)} د.م
                </dd>
              </div>
              {remaining > 0.01 && (
                <div className="flex justify-between">
                  <dt className="text-gray-600">متبقي</dt>
                  <dd className="font-bold text-amber-600">
                    {formatMoney(remaining)} د.م
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Allocations */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <CreditCard className="h-4 w-4 text-gray-400" />
              المدفوعات ({invoice.allocations.length})
            </h3>
            {invoice.allocations.length === 0 ? (
              <p className="text-sm text-gray-500">
                لا توجد مدفوعات مسجلة على هذه الفاتورة.
              </p>
            ) : (
              <div className="space-y-2">
                {invoice.allocations.map((a) => (
                  <Link
                    key={a.id}
                    href={`/wholesale/payments/${a.payment.id}`}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-gray-900">
                        {a.payment.paymentNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(a.payment.paidAt)}
                      </p>
                    </div>
                    <p className="font-bold text-emerald-600">
                      {formatMoney(a.allocatedAmount)} د.م
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {invoice.notes && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                ملاحظات
              </h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {invoice.notes}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              معلومات
            </h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-gray-500">تاريخ الإصدار</dt>
                <dd className="text-gray-900">
                  {formatDateTime(invoice.issuedAt)}
                </dd>
              </div>
              {invoice.dueAt && (
                <div>
                  <dt className="text-gray-500">تاريخ الاستحقاق</dt>
                  <dd className="text-gray-900">
                    {formatDateTime(invoice.dueAt)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {invoice.creditNote && (
            <Card className="border-red-200">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-red-900">
                <FileText className="h-4 w-4" />
                إشعار دائن
              </h3>
              <p className="text-lg font-bold text-red-700">
                {formatMoney(invoice.creditNote.amount)} د.م
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {invoice.creditNote.reasonCode} ·{" "}
                {formatDateTime(invoice.creditNote.issuedAt)}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}