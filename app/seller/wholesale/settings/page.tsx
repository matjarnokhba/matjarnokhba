"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, ArrowLeft, X } from "lucide-react";

export default function WholesaleSettingsPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleLeave() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/seller/wholesale/leave", { method: "POST" });
      const d = await res.json();
      if (d.success) {
        router.push("/seller");
        router.refresh();
      } else {
        setError(d.message || "فشل الإلغاء");
        setSubmitting(false);
      }
    } catch {
      setError("خطأ في الاتصال");
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-2xl mx-auto" dir="rtl">
      <Link href="/seller/wholesale" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
        <ArrowLeft className="h-3.5 w-3.5" /> عودة لبوابة الجملة
      </Link>

      <h1 className="text-2xl font-black mb-2">إعدادات الجملة</h1>
      <p className="text-sm text-gray-600 mb-6">إدارة انضمامك لسوق الجملة</p>

      <div className="rounded-xl bg-red-50 border-2 border-red-200 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-bold text-red-900">إلغاء الانضمام لسوق الجملة</h2>
            <p className="text-xs text-red-700 mt-1 mb-3">
              سيتم إخفاء عروضك من السوق، ولن تتمكن من استقبال طلبات جديدة. يمكنك الانضمام مجددًا في أي وقت.
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              إلغاء الانضمام
            </button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => !submitting && setShowConfirm(false)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">تأكيد الإلغاء</h2>
              <button onClick={() => !submitting && setShowConfirm(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-700 mb-4">
              هل أنت متأكد؟ ستُخفى كل عروضك النشطة. يمكنك الانضمام مجددًا لاحقًا.
            </p>
            {error && <div className="mb-3 rounded bg-red-50 p-2 text-xs text-red-700">{error}</div>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConfirm(false)} disabled={submitting} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
              <button onClick={handleLeave} disabled={submitting} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}