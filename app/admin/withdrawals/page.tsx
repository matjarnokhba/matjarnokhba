"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Wallet, RefreshCw } from "lucide-react";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [releasing, setReleasing] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/withdrawals");
      const data = await res.json();
      if (data.success) setWithdrawals(data.withdrawals);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAction(id: number, status: "PAID" | "REJECTED") {
    if (!confirm(`هل أنت متأكد من ${status === "PAID" ? "تحويل المبلغ" : "رفض الطلب"}؟`)) return;
    
    setProcessing(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: status === "REJECTED" ? "مرفوض من الإدارة" : null })
      });
      if (res.ok) loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReleaseHolds() {
    if (!confirm("هل تريد تحرير جميع الأرباح التي مر عليها أكثر من 3 أيام؟")) return;
    setReleasing(true);
    try {
      const res = await fetch("/api/admin/release-holds", { method: "POST" });
      const data = await res.json();
      if (data.success) alert(`تم تحرير ${data.releasedCount} حركة بنجاح.`);
    } catch (e) {
      console.error(e);
    } finally {
      setReleasing(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Wallet className="h-6 w-6 text-[#ff5c00]" />
            إدارة المحافظ والسحوبات
          </h1>
          <p className="text-sm text-gray-500 mt-1">مراجعة طلبات السحب، وتحرير الأرباح المحجوزة</p>
        </div>
        <button
          onClick={handleReleaseHolds}
          disabled={releasing}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#0a1f44] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#1a2f54]"
        >
          {releasing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          تحرير الأرباح المحجوزة (3 أيام)
        </button>
      </div>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3">التاجر</th>
              <th className="px-4 py-3">المبلغ</th>
              <th className="px-4 py-3">طريقة الاستلام</th>
              <th className="px-4 py-3">التاريخ</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {withdrawals.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-bold">{w.seller.storeName}</div>
                  <div className="text-[10px] text-gray-500">{w.seller.user.phone}</div>
                </td>
                <td className="px-4 py-3 font-black text-[#ff5c00]">{Number(w.amount).toFixed(2)} د.م</td>
                <td className="px-4 py-3 text-xs">
                  {w.bankDetails?.method === "bank" ? "تحويل بنكي" : w.bankDetails?.method}
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5" dir="ltr">
                    {w.bankDetails?.accountNumber}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(w.requestedAt).toLocaleDateString("ar-MA")}
                </td>
                <td className="px-4 py-3">
                  {w.status === "PENDING" && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">قيد المراجعة</span>}
                  {w.status === "PAID" && <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full text-[10px]">تم التحويل</span>}
                  {w.status === "REJECTED" && <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full text-[10px]">مرفوض</span>}
                </td>
                <td className="px-4 py-3">
                  {w.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => handleAction(w.id, "PAID")} disabled={processing === w.id} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200" title="تم التحويل">
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleAction(w.id, "REJECTED")} disabled={processing === w.id} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="رفض">
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">لا توجد طلبات سحب حتى الآن</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}