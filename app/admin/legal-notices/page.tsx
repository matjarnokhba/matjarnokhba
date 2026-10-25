"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Clock,
  User,
  Phone,
  RefreshCw,
  ArrowLeft,
  X,
} from "lucide-react";

type LegalNotice = {
  id: number;
  driverId: number;
  amountOwed: string;
  reason: string | null;
  status: string;
  deadlineAt: string;
  createdAt: string;
  resolvedAt: string | null;
  escalatedAt: string | null;
  driver: {
    id: number;
    city: string;
    user: { name: string; phone: string | null };
  };
};

const FILTERS = [
  { value: "ALL", label: "الكل", color: "bg-gray-100 text-gray-700" },
  { value: "WARNING", label: "نشط", color: "bg-amber-100 text-amber-700" },
  {
    value: "ESCALATED",
    label: "متأخر",
    color: "bg-red-100 text-red-700",
  },
  {
    value: "RESOLVED",
    label: "مغلق",
    color: "bg-green-100 text-green-700",
  },
];

export default function LegalNoticesPage() {
  const [notices, setNotices] = useState<LegalNotice[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<LegalNotice | null>(null);
  const [note, setNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/legal-notices?filter=${filter}`);
      const data = await res.json();
      if (data.success) setNotices(data.notices);
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

  async function handleResolve() {
    if (!selected || note.trim().length < 3) return;
    setResolving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/legal-notices/${selected.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل الإغلاق");
        return;
      }
      setSelected(null);
      setNote("");
      await load();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setResolving(false);
    }
  }

  function statusBadge(notice: LegalNotice) {
    if (notice.status === "RESOLVED") {
      return {
        label: "مغلق",
        class: "bg-green-100 text-green-700",
        icon: CheckCircle2,
      };
    }
    if (notice.status === "ESCALATED") {
      return {
        label: "متأخر - جاهز للقانوني",
        class: "bg-red-100 text-red-700",
        icon: ShieldAlert,
      };
    }
    return {
      label: "قيد الانتظار",
      class: "bg-amber-100 text-amber-700",
      icon: Clock,
    };
  }

  function daysLeft(deadline: string) {
    const d = new Date(deadline);
    const diff = d.getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        رجوع للوحة الإدارة
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            الإنذارات القانونية
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            السائقون الذين لديهم مستحقات غير مسددة (كاش / مرتجعات).
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold hover:bg-gray-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          تحديث
        </button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === f.value
                ? f.color + " ring-2 ring-offset-1 ring-current"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin h-8 w-8 text-red-600" />
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-3" />
          <p className="font-bold text-lg text-gray-900">
            لا توجد إنذارات
          </p>
          <p className="text-sm text-gray-500">
            كل السائقين منتظمون في السداد.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const badge = statusBadge(notice);
            const BadgeIcon = badge.icon;
            const days = daysLeft(notice.deadlineAt);

            return (
              <div
                key={notice.id}
                className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 font-black text-lg">
                      {notice.driver.user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">
                        {notice.driver.user.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        📍 {notice.driver.city}
                        {notice.driver.user.phone && (
                          <span dir="ltr"> · {notice.driver.user.phone}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${badge.class}`}
                  >
                    <BadgeIcon className="h-3 w-3" />
                    {badge.label}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3 mb-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">المبلغ المستحق:</span>
                    <span className="font-black text-red-600">
                      {Number(notice.amountOwed).toFixed(2)} د.م
                    </span>
                  </div>
                  {notice.reason && (
                    <div className="text-gray-600">
                      <span className="font-bold">السبب: </span>
                      {notice.reason}
                    </div>
                  )}
                  {notice.status === "WARNING" && (
                    <div className="flex justify-between pt-1 border-t border-gray-200">
                      <span className="text-gray-600">المهلة المتبقية:</span>
                      <span
                        className={`font-black ${
                          days <= 3
                            ? "text-red-600"
                            : days <= 7
                              ? "text-amber-600"
                              : "text-gray-800"
                        }`}
                      >
                        {days > 0 ? `${days} يوم` : "منتهية"}
                      </span>
                    </div>
                  )}
                </div>

                {notice.status !== "RESOLVED" && (
                  <button
                    onClick={() => {
                      setSelected(notice);
                      setNote("");
                      setError("");
                    }}
                    className="w-full rounded-lg bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700"
                  >
                    إغلاق الإنذار يدوياً
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal الإغلاق اليدوي */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">
                إغلاق إنذار {selected.driver.user.name}
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 p-3 mb-4 text-xs text-amber-800 border border-amber-200">
              ⚠️ سيتم إغلاق الإنذار نهائياً. اكتب سبب الإغلاق (مثل: تم
              التسوية، أو التنازل).
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="ملاحظة الإدارة..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-red-500 focus:bg-white"
            />

            {error && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleResolve}
                disabled={resolving || note.trim().length < 3}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {resolving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تأكيد الإغلاق
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={resolving}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
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