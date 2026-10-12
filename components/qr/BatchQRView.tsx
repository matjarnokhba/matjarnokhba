"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  User,
  Check,
  CheckCircle2,
  AlertCircle,
  Warehouse,
  Store,
} from "lucide-react";

const CURRENCY = "د.م";

export default function BatchQRView({
  batch,
  userRole,
}: {
  batch: any;
  userRole: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const isWarehouse =
    userRole === "WAREHOUSE_MANAGER" ||
    userRole === "ADMIN" ||
    userRole === "SUPER_ADMIN";

  const isDelivered = batch.status === "DELIVERED";

  async function handleReceive() {
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/warehouse/batches/${batch.id}/receive`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "فشل الاستلام",
        });
        return;
      }

      if (data.alreadyReceived) {
        setMessage({
          type: "info",
          text: "تم استلام هذه الدفعة مسبقًا",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم استلام ${data.itemsReceived} طرد بنجاح`,
      });

      setTimeout(() => {
        window.location.href = "/warehouse";
      }, 2000);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div
        className="mb-4 rounded-2xl p-5 text-white shadow-md"
        style={{
          background: isDelivered
            ? "linear-gradient(135deg, #16a34a, #15803d)"
            : "linear-gradient(135deg, #0f766e, #115e59)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
            {isDelivered ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Warehouse className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-lg font-black">
              {isDelivered ? "دفعة مُستلمة" : "دفعة جمع"}
            </h1>
            <p className="mt-0.5 text-xs opacity-90">
              {isDelivered
                ? "تم استلام كل الطرود في المستودع"
                : "بانتظار مسح المستودع"}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Batch Info ═══ */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] text-gray-500">رقم الدفعة</div>
            <div className="mt-0.5 font-mono text-base font-black">
              {batch.batchNumber}
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              isDelivered
                ? "bg-green-100 text-green-700"
                : "bg-teal-100 text-teal-700"
            }`}
          >
            {isDelivered ? "✅ مستلمة" : "🚚 في الطريق"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-black text-gray-900">
              {batch.totalOrders}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">طلبات</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-2xl font-black text-gray-900">
              {batch.itemsCount}
            </div>
            <div className="mt-1 text-[10px] text-gray-500">عنصر</div>
          </div>
        </div>

        {/* ═══ Collector ═══ */}
        <div className="mt-4 rounded-lg border border-gray-100 p-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-xs font-bold">{batch.collector.name}</span>
          </div>
          {batch.collector.phone && (
            <div className="mt-1 text-[11px] text-gray-500" dir="ltr">
              {batch.collector.phone}
            </div>
          )}
        </div>

        {/* ═══ Sellers ═══ */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="mb-2 text-xs font-black text-gray-700">
            تم الجمع من ({new Set(batch.items.map((bi: any) => bi.fulfillmentItem.seller.id)).size} تاجر)
          </div>
          <div className="space-y-2">
            {batch.items.slice(0, 10).map((bi: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
              >
                <Store className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">
                    {bi.fulfillmentItem.seller.storeName}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    <span className="font-mono">
                      {bi.fulfillmentItem.orderItem.order.orderNumber}
                    </span>
                    {bi.fulfillmentItem.seller.city && (
                      <> · {bi.fulfillmentItem.seller.city}</>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {batch.items.length > 10 && (
              <div className="text-center text-[11px] text-gray-500">
                +{batch.items.length - 10} عناصر أخرى
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ رسالة ═══ */}
      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : message.type === "error"
                ? "bg-red-50 text-red-700"
                : "bg-blue-50 text-blue-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ═══ Actions ═══ */}
      {isWarehouse && !isDelivered && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 p-5">
          <div className="mb-4 text-center text-sm font-black text-teal-900">
            تأكيد استلام الدفعة كاملة ({batch.itemsCount} طرد)
          </div>
          <button
            onClick={handleReceive}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-5 w-5" />
            )}
            نعم — استلمت الدفعة كاملة
          </button>
        </div>
      )}

      {isDelivered && (
        <div className="mt-4 rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
          <div className="mt-2 text-base font-black text-green-900">
            ✅ تم إكمال المهمة
          </div>
          <p className="mt-1 text-xs text-green-700">
            استُلمت الدفعة في المستودع
            {batch.receivedAt && (
              <>
                {" "}
                —{" "}
                {new Date(batch.receivedAt).toLocaleString("ar-MA", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </>
            )}
          </p>
        </div>
      )}

      {/* ═══ Back link ═══ */}
      <div className="mt-4">
        {userRole === "COLLECTOR" && (
          <Link
            href="/collector"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowRight className="h-4 w-4" />
            لوحة الجمع
          </Link>
        )}
        {isWarehouse && (
          <Link
            href="/warehouse"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <ArrowRight className="h-4 w-4" />
            لوحة المستودع
          </Link>
        )}
      </div>
    </div>
  );
}