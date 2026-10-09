"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  Check,
  MapPin,
  Truck,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
} from "lucide-react";

type CollectionItem = {
  id: number;
  fulfillmentItemId: number;
  orderId: number;
  orderNumber: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  collectedAt: string | null;
  departedAt: string | null;
  fulfillmentStatus: string;
};

type SellerGroup = {
  sellerId: number;
  sellerName: string;
  sellerSlug: string;
  city: string | null;
  region: string | null;
  items: CollectionItem[];
};

type Assignment = {
  id: number;
  assignmentNumber: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdAt: string;
  itemsCount: number;
  collectedCount: number;
  sellers: SellerGroup[];
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ASSIGNED: { label: "مُسند", cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "قيد التنفيذ", cls: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "مكتمل", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", cls: "bg-red-100 text-red-700" },
};

export default function DeliveryCollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    | { type: "start" }
    | { type: "complete" }
    | { type: "pickup"; item: CollectionItem }
    | { type: "depart"; item: CollectionItem }
    | null
  >(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/collections/${collectionId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "التكليف غير موجود");
        return;
      }
      setAssignment(data.assignment);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (collectionId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  async function executeAction(
    action: "start" | "pickup" | "depart" | "complete",
    fulfillmentItemId?: number
  ) {
    setSubmitting(true);
    setError("");

    try {
      const body: any = { action };
      if (fulfillmentItemId) body.fulfillmentItemId = fulfillmentItemId;

      const res = await fetch(
        `/api/delivery/collections/${collectionId}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التنفيذ");
        return;
      }

      setSuccessMsg(data.message || "تم بنجاح");
      setConfirmAction(null);
      await load();

      setTimeout(() => setSuccessMsg(""), 3000);

      // لو إكمال، ارجع للقائمة
      if (action === "complete") {
        setTimeout(() => {
          router.push("/delivery/collections");
        }, 1500);
      }
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    );
  }

  if (error && !assignment) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link
            href="/delivery/collections"
            className="mt-6 inline-block rounded-full bg-green-500 px-6 py-2.5 text-sm font-bold text-white"
          >
            عودة للقائمة
          </Link>
        </div>
      </div>
    );
  }

  if (!assignment) return null;

  const info = STATUS_LABELS[assignment.status] || STATUS_LABELS.ASSIGNED;
  const progress =
    assignment.itemsCount > 0
      ? Math.round(
          (assignment.collectedCount / assignment.itemsCount) * 100
        )
      : 0;

  const canStart = assignment.status === "ASSIGNED";
  const canAct = assignment.status === "IN_PROGRESS";
  const allCollected = assignment.collectedCount === assignment.itemsCount;
  const canComplete = canAct && allCollected;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/delivery/collections"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-green-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للقائمة
      </Link>

      {/* Header */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">رقم التكليف</div>
            <div className="mt-1 font-mono text-xl font-black">
              {assignment.assignmentNumber}
            </div>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-bold ${info.cls}`}
          >
            {info.label}
          </span>
        </div>

        {assignment.itemsCount > 0 && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-gray-500">
              {assignment.collectedCount} / {assignment.itemsCount} تم جمعها
            </div>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-xs text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Action: Start */}
      {canStart && (
        <div className="mb-5">
          <button
            onClick={() => setConfirmAction({ type: "start" })}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95"
          >
            <Truck className="h-5 w-5" />
            بدء التنفيذ
          </button>
        </div>
      )}

      {/* Sellers + Items */}
      <div className="space-y-4">
        {assignment.sellers.map((seller) => (
          <div
            key={seller.sellerId}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            {/* Seller Header */}
            <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a1f44] to-purple-600 text-sm font-black text-white">
                {seller.sellerName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black">
                  {seller.sellerName}
                </div>
                {seller.city && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <MapPin className="h-2.5 w-2.5" />
                    {seller.city}
                    {seller.region && ` · ${seller.region}`}
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              {seller.items.map((item) => {
                const isCollected = !!item.collectedAt;
                const isDeparted = !!item.departedAt;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border-2 p-3 transition ${
                      isCollected
                        ? "border-green-200 bg-green-50/50"
                        : "border-gray-100 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="h-12 w-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-100">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">
                          {item.productName}
                        </div>
                        {item.variantName && (
                          <div className="text-[10px] text-gray-500">
                            {item.variantName}
                          </div>
                        )}
                        <div className="mt-0.5 font-mono text-[9px] text-gray-400">
                          {item.orderNumber}
                        </div>
                      </div>

                      <div className="shrink-0 text-xs font-black">
                        ×{item.quantity}
                      </div>
                    </div>

                    {/* Actions */}
                    {canAct && (
                      <div className="mt-3 flex gap-2 border-t border-dashed border-gray-200 pt-2">
                        {!isCollected ? (
                          <button
                            onClick={() =>
                              setConfirmAction({
                                type: "pickup",
                                item,
                              })
                            }
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-500 py-2 text-[11px] font-bold text-white transition hover:bg-green-600"
                          >
                            <Check className="h-3.5 w-3.5" />
                            تم الجمع
                          </button>
                        ) : !isDeparted ? (
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              تم الجمع
                            </span>
                            <button
                              onClick={() =>
                                setConfirmAction({
                                  type: "depart",
                                  item,
                                })
                              }
                              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-indigo-600"
                            >
                              <Truck className="h-3 w-3" />
                              مغادرة
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-50 py-2 text-[10px] font-bold text-indigo-700">
                            <Truck className="h-3.5 w-3.5" />
                            في الطريق للمستودع
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Action: Complete */}
      {canAct && (
        <div className="mt-5">
          <button
            onClick={() => {
              if (!canComplete) {
                setError(
                  `لا يمكن الإكمال — لم يتم جمع ${assignment.itemsCount - assignment.collectedCount} عنصر بعد`
                );
                return;
              }
              setConfirmAction({ type: "complete" });
            }}
            disabled={!canComplete}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#0a1f44] to-purple-600 py-4 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 className="h-5 w-5" />
            إكمال التكليف
          </button>
          {!canComplete && (
            <p className="mt-2 text-center text-[10px] text-gray-500">
              يجب جمع كل العناصر أولاً
            </p>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {confirmAction.type === "start"
                  ? "بدء التنفيذ"
                  : confirmAction.type === "complete"
                    ? "إكمال التكليف"
                    : confirmAction.type === "pickup"
                      ? "تأكيد الجمع"
                      : "تأكيد المغادرة"}
              </h3>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-xs text-gray-600">
              {confirmAction.type === "start"
                ? "هل بدأت التنفيذ؟ سيتم تسجيل وقت البدء."
                : confirmAction.type === "complete"
                  ? "هل تم جمع كل العناصر بنجاح؟ سيتم إكمال التكليف."
                  : confirmAction.type === "pickup"
                    ? `هل استلمت "${confirmAction.item.productName}" من التاجر؟`
                    : `هل أنت متجه الآن للمستودع مع "${confirmAction.item.productName}"؟`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() =>
                  executeAction(
                    confirmAction.type,
                    confirmAction.type === "pickup" ||
                      confirmAction.type === "depart"
                      ? confirmAction.item.fulfillmentItemId
                      : undefined
                  )
                }
                disabled={submitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-500 py-3 text-sm font-bold text-white transition hover:bg-green-600 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                تأكيد
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}