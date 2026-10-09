"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Truck,
  MapPin,
  User,
  ChevronLeft,
  CheckCircle2,
  Clock,
} from "lucide-react";

type Assignment = {
  id: number;
  assignmentNumber: string;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  itemsCount: number;
  collectedCount: number;
  sellersCount: number;
  cities: string[];
};

type Stats = {
  active: number;
  completed: number;
  total: number;
};

type Filter = "ACTIVE" | "COMPLETED";

const STATUS_INFO: Record<string, { label: string; cls: string }> = {
  ASSIGNED: { label: "مُسند", cls: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "قيد التنفيذ", cls: "bg-amber-100 text-amber-700" },
  COMPLETED: { label: "مكتمل", cls: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", cls: "bg-red-100 text-red-700" },
};

export default function DeliveryCollectionsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [stats, setStats] = useState<Stats>({
    active: 0,
    completed: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/delivery/collections?status=${filter}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setAssignments(data.assignments);
      setStats(data.stats);
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
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Truck className="h-6 w-6 text-green-600" />
          جمع المنتجات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          المهام المُسندة إليك من التجار
        </p>
      </div>

      <div className="mb-5 flex gap-2">
        <button
          onClick={() => setFilter("ACTIVE")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            filter === "ACTIVE"
              ? "bg-green-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          النشطة
        </button>
        <button
          onClick={() => setFilter("COMPLETED")}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
            filter === "COMPLETED"
              ? "bg-green-500 text-white"
              : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          المكتملة
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error}
        </div>
      ) : assignments.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {filter === "ACTIVE"
              ? "لا توجد مهام جمع نشطة"
              : "لا توجد مهام جمع مكتملة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const info = STATUS_INFO[a.status] || STATUS_INFO.ASSIGNED;
            const progress =
              a.itemsCount > 0
                ? Math.round((a.collectedCount / a.itemsCount) * 100)
                : 0;

            return (
              <Link
                key={a.id}
                href={`/delivery/collections/${a.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
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
                        {a.sellersCount} تاجر
                      </span>
                      <span>·</span>
                      <span>{a.itemsCount} عنصر</span>
                    </div>

                    {a.cities.length > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                        <MapPin className="h-3 w-3" />
                        {a.cities.join(" · ")}
                      </div>
                    )}

                    {a.itemsCount > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full bg-green-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="mt-0.5 text-[9px] text-gray-500">
                          {a.collectedCount} / {a.itemsCount} تم جمعها
                        </div>
                      </div>
                    )}
                  </div>

                  <ChevronLeft className="h-5 w-5 shrink-0 text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}