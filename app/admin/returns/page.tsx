"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  ChevronLeft,
} from "lucide-react";

type ReturnRequest = {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";
  reason: string;
  adminNote: string | null;
  requestedAt: string;
  processedAt: string | null;
  user: { id: number; name: string; email: string };
  order: { id: number; orderNumber: string; total: string };
  items: {
    id: number;
    quantity: number;
    refundAmount: string;
    orderItem: {
      productName: string;
      imageUrl: string | null;
      quantity: number;
    };
  }[];
};

type Filter = "PENDING" | "APPROVED" | "COMPLETED" | "REJECTED" | "ALL";

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> =
  {
    PENDING: {
      label: "قيد المراجعة",
      color: "text-amber-700",
      bg: "bg-amber-100",
    },
    APPROVED: {
      label: "تمت الموافقة",
      color: "text-blue-700",
      bg: "bg-blue-100",
    },
    REJECTED: {
      label: "مرفوض",
      color: "text-red-700",
      bg: "bg-red-100",
    },
    COMPLETED: {
      label: "مكتمل",
      color: "text-green-700",
      bg: "bg-green-100",
    },
  };

const CURRENCY = "د.م";

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/returns?status=${filter}`);
      const data = await res.json();
      if (data.success) setReturns(data.returns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">إدارة الإرجاع</h1>
        <p className="mt-1 text-sm text-gray-500">
          مراجعة طلبات إرجاع العملاء والموافقة عليها أو رفضها
        </p>
      </div>

      {/* الفلاتر */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          ["PENDING", "APPROVED", "COMPLETED", "REJECTED", "ALL"] as Filter[]
        ).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "PENDING" && "قيد المراجعة"}
            {f === "APPROVED" && "تمت الموافقة"}
            {f === "COMPLETED" && "مكتمل"}
            {f === "REJECTED" && "مرفوض"}
            {f === "ALL" && "الكل"}
          </button>
        ))}
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : returns.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">📭</div>
          <h3 className="mt-4 text-lg font-black">لا توجد طلبات إرجاع</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "PENDING"
              ? "لا توجد طلبات بانتظار المراجعة"
              : "لا توجد طلبات في هذه الحالة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((ret) => {
            const info = STATUS_INFO[ret.status];
            return (
              <Link
                key={ret.id}
                href={`/admin/returns/${ret.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                {/* رأس */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                      <RotateCcw className="h-5 w-5 text-[#ff5c00]" />
                    </div>
                    <div>
                      <div className="text-sm font-black">
                        طلب إرجاع #{ret.id}
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {ret.user.name} ·{" "}
                        {new Date(ret.requestedAt).toLocaleDateString("ar-MA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold ${info.bg} ${info.color}`}
                  >
                    {info.label}
                  </span>
                </div>

                {/* الطلب الأصلي */}
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-xs">
                  <span className="rounded-full bg-gray-50 px-2.5 py-1 font-mono">
                    {ret.order.orderNumber}
                  </span>
                  <span className="text-gray-500">
                    الإجمالي: <strong>{ret.order.total} {CURRENCY}</strong>
                  </span>
                  <span className="text-gray-500">
                    {ret.items.length} منتج
                  </span>
                </div>

                {/* السبب */}
                <div className="mt-3 line-clamp-1 text-xs text-gray-600">
                  <strong>السبب:</strong> {ret.reason}
                </div>

                {/* زر */}
                <div className="mt-3 flex items-center justify-end text-xs font-bold text-[#ff5c00]">
                  عرض التفاصيل
                  <ChevronLeft className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}