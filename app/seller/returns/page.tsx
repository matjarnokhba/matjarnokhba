"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RotateCcw,
  Package,
  Search,
  ChevronLeft,
  User,
  Phone,
  CheckCircle2,
  Truck,
  AlertTriangle,
  X,
} from "lucide-react";

const CURRENCY = "د.م";

type ReturnRow = {
  id: number;
  returnNumber: string;
  status: string;
  inspectionStatus: string | null;
  inspectionNotes: string | null;
  sellerRejectionReason: string | null;
  createdAt: string;
  inspectedAt: string | null;
  returnAssignedAt: string | null;
  deliveredToSellerAt: string | null;
  sellerConfirmedAt: string | null;
  deliveryTokenPreview: string;
  deliveryRawToken: string | null;
  returnRequest: {
    id: number;
    reason: string;
    order: { id: number; orderNumber: string };
    user: { id: number; name: string; phone: string | null };
    items: Array<{
      id: number;
      quantity: number;
      orderItem: {
        id: number;
        productName: string;
        variantName: string | null;
        imageUrl: string | null;
        quantity: number;
        unitPrice: number;
      };
    }>;
  };
};

type Stats = {
  pending: number;
  delivered: number;
  completed: number;
  total: number;
};

export default function SellerReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    delivered: 0,
    completed: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ACTIVE" | "COMPLETED" | "ALL">("ACTIVE");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/returns?status=${filter}`);
      const data = await res.json();
      if (data.success) {
        setReturns(data.returns || []);
        setStats(data.stats || stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return returns;
    const q = search.trim().toLowerCase();
    return returns.filter(
      (r) =>
        r.returnNumber.toLowerCase().includes(q) ||
        r.returnRequest.order.orderNumber.toLowerCase().includes(q) ||
        r.returnRequest.user.name.toLowerCase().includes(q)
    );
  }, [returns, search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <RotateCcw className="h-6 w-6 text-orange-600" />
          المرتجعات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          المنتجات التي أعادها العملاء إليك
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-amber-700">
            {stats.pending}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">قيد الانتظار</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-orange-700">
            {stats.delivered}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">مرفوضة</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-green-700">
            {stats.completed}
          </div>
          <div className="mt-1 text-[10px] text-gray-500">مكتملة</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-gray-900">{stats.total}</div>
          <div className="mt-1 text-[10px] text-gray-500">الإجمالي</div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: "ACTIVE", label: "نشطة" },
          { key: "COMPLETED", label: "مكتملة" },
          { key: "ALL", label: "الكل" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f.key
                ? "bg-orange-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم المرتجع أو الطلب أو اسم العميل..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <RotateCcw className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد مرتجعات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const canConfirm = r.status === "IN_TRANSIT_TO_SELLER";
            const isCompleted = r.status === "COMPLETED";
            const isRejected = r.status === "DELIVERED_TO_SELLER";

            return (
              <div
                key={r.id}
                className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${
                  canConfirm
                    ? "border-orange-300"
                    : isCompleted
                      ? "border-green-200"
                      : isRejected
                        ? "border-red-200"
                        : "border-gray-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">
                        {r.returnNumber}
                      </span>
                      <ReturnStatusBadge
                        status={r.status}
                        inspectionStatus={r.inspectionStatus}
                      />
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                      <User className="h-3 w-3" />
                      {r.returnRequest.user.name}
                      {r.returnRequest.user.phone && (
                        <span dir="ltr" className="text-[10px]">
                          · {r.returnRequest.user.phone}
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-[11px] text-gray-500">
                      طلب:{" "}
                      <span className="font-mono">
                        {r.returnRequest.order.orderNumber}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-gray-600">
                      سبب الإرجاع: {r.returnRequest.reason}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                  {r.returnRequest.items.map((ri) => (
                    <div
                      key={ri.id}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
                    >
                      {ri.orderItem.imageUrl ? (
                        <img
                          src={ri.orderItem.imageUrl}
                          alt={ri.orderItem.productName}
                          className="h-11 w-11 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-gray-200">
                          <Package className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold">
                          {ri.orderItem.productName}
                        </div>
                        {ri.orderItem.variantName && (
                          <div className="text-[10px] text-gray-500">
                            {ri.orderItem.variantName}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-black text-orange-600">
                        ×{ri.quantity}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Inspection info */}
                {r.inspectionStatus && (
                  <div
                    className={`mt-3 flex items-start gap-2 rounded-lg p-3 text-xs ${
                      r.inspectionStatus === "INTACT"
                        ? "bg-green-50 text-green-800"
                        : r.inspectionStatus === "DAMAGED"
                          ? "bg-red-50 text-red-800"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <div className="font-bold">
                        حالة الفحص: {inspectionLabel(r.inspectionStatus)}
                      </div>
                      {r.inspectionNotes && (
                        <div className="mt-0.5">{r.inspectionNotes}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection reason */}
                {r.sellerRejectionReason && (
                  <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    سبب الرفض: {r.sellerRejectionReason}
                  </div>
                )}

                {/* Actions */}
                {canConfirm && r.deliveryRawToken && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Link
                      href={`/r/${r.deliveryRawToken}`}
                      className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      استلمت — تأكيد
                    </Link>
                    <Link
                      href={`/r/${r.deliveryRawToken}`}
                      className="flex items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-50 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                      <X className="h-4 w-4" />
                      رفض الاستلام
                    </Link>
                  </div>
                )}

                {isCompleted && (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-green-50 py-2.5 text-xs font-bold text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    تم تأكيد الاستلام
                  </div>
                )}

                {isRejected && (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-red-50 py-2.5 text-xs font-bold text-red-700">
                    <X className="h-4 w-4" />
                    تم رفض الاستلام — بانتظار الإدارة
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReturnStatusBadge({
  status,
  inspectionStatus,
}: {
  status: string;
  inspectionStatus: string | null;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    INSPECTED: {
      label: "🏭 جاهز للإرجاع",
      cls: "bg-teal-100 text-teal-700",
    },
    IN_TRANSIT_TO_SELLER: {
      label: "🚚 في الطريق إليك",
      cls: "bg-orange-100 text-orange-700",
    },
    DELIVERED_TO_SELLER: {
      label: "❌ رفضت الاستلام",
      cls: "bg-red-100 text-red-700",
    },
    COMPLETED: { label: "✅ مكتمل", cls: "bg-green-100 text-green-700" },
    PENDING_PICKUP: {
      label: "⏳ بانتظار استلام العميل",
      cls: "bg-amber-100 text-amber-700",
    },
    PICKED_UP: {
      label: "📦 مع الجمع",
      cls: "bg-blue-100 text-blue-700",
    },
    IN_TRANSIT_TO_WAREHOUSE: {
      label: "🚚 للمستودع",
      cls: "bg-indigo-100 text-indigo-700",
    },
  };
  const info = map[status] || {
    label: status,
    cls: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

function inspectionLabel(status: string | null): string {
  if (!status) return "—";
  return (
    {
      INTACT: "سليم",
      DAMAGED: "متضرر",
      INCOMPLETE: "ناقص",
    }[status] || status
  );
}