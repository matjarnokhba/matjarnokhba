"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";

type OrderStatusChangerProps = {
  orderId: number;
  currentStatus: string;
};

const STATUSES = [
  { value: "NEW", label: "جديد" },
  { value: "PROCESSING", label: "قيد المعالجة" },
  { value: "SHIPPED", label: "تم الشحن" },
  { value: "DELIVERED", label: "تم التسليم" },
  { value: "CANCELLED", label: "ملغى" },
];

export default function OrderStatusChanger({
  orderId,
  currentStatus,
}: OrderStatusChangerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (selected === currentStatus) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحديث");
        setLoading(false);
        return;
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[#ff5c00]"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <button
        onClick={handleSave}
        disabled={loading || selected === currentStatus}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        حفظ
      </button>

      {error && (
        <span className="text-[11px] font-bold text-red-600">{error}</span>
      )}
      {success && (
        <span className="text-[11px] font-bold text-green-600">
          ✓ تم التحديث
        </span>
      )}
    </div>
  );
}