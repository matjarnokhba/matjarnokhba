"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Ticket,
  Loader2,
  Trash2,
  Calendar,
  Percent,
  X,
} from "lucide-react";

type Coupon = {
  id: number;
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: string;
  minOrderAmount: string | null;
  maxUses: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  _count?: { usages: number };
};

const CURRENCY = "د.م";

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  async function loadCoupons() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const data = await res.json();
      if (data.success) setCoupons(data.coupons);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCoupons();
  }, []);

  async function handleToggle(id: number, current: boolean) {
    setActionId(id);
    try {
      await fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      await loadCoupons();
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل أنت متأكد من حذف هذا الكوبون؟")) return;
    setActionId(id);
    try {
      await fetch(`/api/admin/coupons/${id}`, { method: "DELETE" });
      await loadCoupons();
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">إدارة الكوبونات</h1>
          <p className="mt-1 text-sm text-gray-500">
            إنشاء وإدارة أكواد الخصم
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          كوبون جديد
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">🎟️</div>
          <h3 className="mt-4 text-lg font-black">لا توجد كوبونات</h3>
          <p className="mt-2 text-sm text-gray-500">
            ابدأ بإنشاء أول كوبون خصم
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((c) => {
            const isExpired = new Date(c.endDate) < new Date();
            const isNotStarted = new Date(c.startDate) > new Date();

            return (
              <div
                key={c.id}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                {/* الكود */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                      <Ticket className="h-5 w-5 text-[#ff5c00]" />
                    </div>
                    <div>
                      <div className="font-mono text-base font-black text-gray-900">
                        {c.code}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {c.type === "PERCENTAGE"
                          ? `خصم ${Number(c.value)}%`
                          : `خصم ${Number(c.value)} ${CURRENCY}`}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={actionId === c.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* الشروط */}
                <div className="mt-3 space-y-1 text-[11px] text-gray-600">
                  {c.minOrderAmount && (
                    <div>
                      الحد الأدنى: <strong>{Number(c.minOrderAmount)} {CURRENCY}</strong>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(c.startDate).toLocaleDateString("ar-MA")} →{" "}
                    {new Date(c.endDate).toLocaleDateString("ar-MA")}
                  </div>
                  <div>
                    الاستخدامات: <strong>{c.usedCount}</strong>
                    {c.maxUses && ` / ${c.maxUses}`}
                  </div>
                  <div>لكل مستخدم: {c.maxUsesPerUser}</div>
                </div>

                {/* الحالة */}
                <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      isExpired
                        ? "bg-gray-100 text-gray-600"
                        : isNotStarted
                          ? "bg-amber-100 text-amber-700"
                          : c.isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isExpired
                      ? "منتهي"
                      : isNotStarted
                        ? "لم يبدأ"
                        : c.isActive
                          ? "مفعّل"
                          : "معطّل"}
                  </span>

                  <button
                    onClick={() => handleToggle(c.id, c.isActive)}
                    disabled={actionId === c.id}
                    className="text-[11px] font-bold text-[#ff5c00] hover:underline disabled:opacity-50"
                  >
                    {c.isActive ? "تعطيل" : "تفعيل"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <NewCouponModal
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            loadCoupons();
          }}
        />
      )}
    </div>
  );
}

// ═══════ نموذج الإنشاء ═══════
function NewCouponModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [maxPerUser, setMaxPerUser] = useState("1");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!code.trim()) {
      setError("أدخل كود الكوبون");
      return;
    }
    if (!value || Number(value) <= 0) {
      setError("أدخل قيمة صحيحة");
      return;
    }
    if (type === "PERCENTAGE" && Number(value) > 100) {
      setError("النسبة لا تتجاوز 100");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          type,
          value: Number(value),
          minOrderAmount: minOrder ? Number(minOrder) : null,
          maxUses: maxUses ? Number(maxUses) : null,
          maxUsesPerUser: Number(maxPerUser) || 1,
          startDate,
          endDate,
          isActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل الإنشاء");
        return;
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">كوبون جديد</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold">
              الكود <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER25"
              dir="ltr"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-[#ff5c00] focus:bg-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold">النوع</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "PERCENTAGE" | "FIXED")}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              >
                <option value="PERCENTAGE">نسبة (%)</option>
                <option value="FIXED">مبلغ ثابت</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">
                القيمة <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min="0"
                step="0.01"
                placeholder={type === "PERCENTAGE" ? "10" : "50"}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold">
              الحد الأدنى للطلب (اختياري)
            </label>
            <input
              type="number"
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              min="0"
              step="0.01"
              placeholder="مثال: 200"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold">
                الحد الأقصى للاستخدامات
              </label>
              <input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                min="1"
                placeholder="بلا حدود"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">لكل مستخدم</label>
              <input
                type="number"
                value={maxPerUser}
                onChange={(e) => setMaxPerUser(e.target.value)}
                min="1"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold">يبدأ</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">ينتهي</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "إنشاء الكوبون"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}