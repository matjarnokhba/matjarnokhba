"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Building2,
  Calendar,
  FileText,
  Receipt,
  Info,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { OrderStatusTimeline } from "./OrderStatusTimeline";
import { OrderActions } from "./OrderActions";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_VARIANT,
  FULFILLMENT_STATUS_LABEL,
  BU_TYPE_LABEL,
  formatDateTime,
  type OrderDetail as OrderDetailType,
} from "./types";

export interface OrderDetailProps {
  order: OrderDetailType;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
}

export function OrderDetail({
  order,
  isBuyer,
  isSeller,
  isAdmin,
}: OrderDetailProps) {
  const [currentStatus, setCurrentStatus] = useState(order.status);

  const role = isBuyer && !isSeller ? "buyer" : isSeller && !isBuyer ? "seller" : "both";

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/orders"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للطلبات
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xl">{order.orderNumber}</span>
            <Badge
              variant={ORDER_STATUS_VARIANT[currentStatus] ?? "gray"}
              dot
            >
              {ORDER_STATUS_LABEL[currentStatus] ?? currentStatus}
            </Badge>
          </span>
        }
        description={`${formatDateTime(order.createdAt)} · ${order.itemsCount} منتج · ${order.totalQty} قطعة`}
      />

      {/* Status timeline */}
      <Card>
        <OrderStatusTimeline status={currentStatus} />
      </Card>

      {/* Cancel banner */}
      {currentStatus === "CANCELLED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">تم إلغاء الطلب</p>
              {order.cancellationReason && (
                <p className="mt-1 text-red-800">{order.cancellationReason}</p>
              )}
              {order.cancelledAt && (
                <p className="mt-1 text-xs text-red-700">
                  {formatDateTime(order.cancelledAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Parties */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              أطراف الطلب
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">البائع</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {order.sellerName}
                </p>
                <p className="text-xs text-gray-500">
                  {BU_TYPE_LABEL[order.seller.type] ?? order.seller.type}
                </p>
                {order.seller.verificationStatus === "VERIFIED" && (
                  <Badge variant="green" size="sm" className="mt-1">
                    موثق
                  </Badge>
                )}
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">المشتري</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {order.buyerName}
                </p>
                <p className="text-xs text-gray-500">
                  {BU_TYPE_LABEL[order.buyer.type] ?? order.buyer.type}
                </p>
                {order.buyer.verificationStatus === "VERIFIED" && (
                  <Badge variant="green" size="sm" className="mt-1">
                    موثق
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Items */}
          <Card padding="none">
            <div className="border-b border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Package className="h-4 w-4 text-gray-400" />
                المنتجات ({order.items.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <div key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">
                        {item.productName}
                      </p>
                      {item.variantAttributes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.variantAttributes.map((a, i) => (
                            <span
                              key={i}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                            >
                              {a.name}: <strong>{a.value}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {item.quantity} × {item.unitPrice.toFixed(2)} د.م ={" "}
                        <strong className="text-gray-900">
                          {item.subtotal.toFixed(2)} د.م
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 bg-gray-50 p-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-600">المجموع الفرعي</dt>
                  <dd className="text-gray-900">
                    {order.subtotal.toFixed(2)} د.م
                  </dd>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">خصم</dt>
                    <dd className="text-emerald-600">
                      −{order.discount.toFixed(2)} د.م
                    </dd>
                  </div>
                )}
                {order.shippingCost > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-600">الشحن</dt>
                    <dd className="text-gray-900">
                      {order.shippingCost.toFixed(2)} د.م
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-black">
                  <dt className="text-gray-900">الإجمالي</dt>
                  <dd className="text-[#ff5c00]">
                    {order.total.toFixed(2)} د.م
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {order.notes && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">ملاحظات</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {order.notes}
              </p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              ملخص الحالة
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">حالة الطلب</dt>
                <dd>
                  <Badge
                    variant={ORDER_STATUS_VARIANT[currentStatus] ?? "gray"}
                  >
                    {ORDER_STATUS_LABEL[currentStatus] ?? currentStatus}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">حالة الدفع</dt>
                <dd>
                  <Badge
                    variant={
                      PAYMENT_STATUS_VARIANT[order.paymentStatus] ?? "gray"
                    }
                  >
                    {PAYMENT_STATUS_LABEL[order.paymentStatus] ??
                      order.paymentStatus}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">حالة التجهيز</dt>
                <dd className="text-gray-900">
                  {FULFILLMENT_STATUS_LABEL[order.fulfillmentStatus] ??
                    order.fulfillmentStatus}
                </dd>
              </div>
              {order.groupNumber && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <dt className="text-gray-500">مجموعة الطلب</dt>
                  <dd className="font-mono text-xs text-gray-900">
                    {order.groupNumber}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              التسلسل الزمني
            </h3>
            <dl className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <div>
                  <dt className="text-gray-500">تم الإنشاء</dt>
                  <dd className="text-gray-900">
                    {formatDateTime(order.createdAt)}
                  </dd>
                </div>
              </div>
              {order.confirmedAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <div>
                    <dt className="text-gray-500">تم التأكيد</dt>
                    <dd className="text-gray-900">
                      {formatDateTime(order.confirmedAt)}
                    </dd>
                  </div>
                </div>
              )}
              {order.shippedAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                  <div>
                    <dt className="text-gray-500">تم الشحن</dt>
                    <dd className="text-gray-900">
                      {formatDateTime(order.shippedAt)}
                    </dd>
                  </div>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <dt className="text-gray-500">تم التسليم</dt>
                    <dd className="font-medium text-emerald-700">
                      {formatDateTime(order.deliveredAt)}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </Card>

          {isBuyer && currentStatus === "DELIVERED" && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                إرجاع المنتجات
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                يمكنك إرجاع منتجات من هذا الطلب إذا كانت هناك مشكلة.
              </p>
              <Link href={`/wholesale/returns/new?orderId=${order.id}`}>
                <Button
                  variant="outline"
                  fullWidth
                  iconLeft={<RotateCcw className="h-4 w-4" />}
                >
                  طلب إرجاع
                </Button>
              </Link>
            </Card>
          )}

          <OrderActions
            orderId={order.id}
            currentStatus={currentStatus}
            isBuyer={isBuyer}
            isSeller={isSeller}
            isAdmin={isAdmin}
            onStatusChange={setCurrentStatus}
          />
        </div>
      </div>
    </div>
  );
}