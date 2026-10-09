"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Truck, Loader2, User } from "lucide-react";

type Assignment = {
  id: number;
  assignmentNumber: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  deliveryPerson: { name: string; phone: string };
  itemsCount: number;
  collectedCount: number;
  sellers: string[];
};

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "بانتظار", cls: "bg-gray-100 text-gray-700" },
  ASSIGNED: { label: "مُسند", cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "قيد التنفيذ", cls: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "مكتمل", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", cls: "bg-red-100 text-red-700" },
};

type Filter = "ALL" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export default function AdminCollectionsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const url =
        filter === "ALL"
          ? "/api/admin/collections"
          : `/api/admin/collections?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setAssignments(data.assignments);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Truck className="h-6 w-6 text-[#ff5c00]" />
            جمع المنتجات
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة تكاليف جمع المنتجات من التجار
          </p>
        </div>
        <Link
          href="/admin/collections/new"
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          تكليف جمع جديد
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(["ALL", "ASSIGNED", "IN_PROGRESS", "COMPLETED"] as Filter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f
                  ? "bg-[#ff5c00] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "ALL"
                ? "الكل"
                : f === "ASSIGNED"
                  ? "مُسند"
                  : f === "IN_PROGRESS"
                    ? "قيد التنفيذ"
                    : "مكتمل"}
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد تكاليف جمع</h3>
          <p className="mt-2 text-sm text-gray-500">
            ابدأ بتكليف سائق لجمع المنتجات الجاهزة
          </p>
          <Link
            href="/admin/collections/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            تكليف جمع جديد
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const info = STATUS_INFO[a.status] || STATUS_INFO.PENDING;
            const progress =
              a.itemsCount > 0
                ? Math.round((a.collectedCount / a.itemsCount) * 100)
                : 0;

            return (
              <div
                key={a.id}
                className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black">
                        {a.assignmentNumber}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}
                      >
                        {info.label}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {a.deliveryPerson.name}
                      </span>
                      <span>·</span>
                      <span>{a.itemsCount} عنصر</span>
                      <span>·</span>
                      <span>{a.sellers.length} تاجر</span>
                    </div>

                    <div className="mt-1 text-[10px] text-gray-400">
                      {new Date(a.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>

                    {a.itemsCount > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full bg-[#ff5c00]"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-[9px] text-gray-500">
                          {a.collectedCount} / {a.itemsCount} تم جمعها
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}