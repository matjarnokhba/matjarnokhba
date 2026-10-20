"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, ShieldAlert, BadgeCheck, CreditCard } from "lucide-react";

export default function SellerSubscriptionPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  async function loadStatus() {
    try {
      const res = await fetch("/api/seller/wallet"); // نستخدم مسار المحفظة لأنه يرجع بيانات التاجر
      const data = await res.json();
      if (data.success) setStatus(data.seller);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handlePay(plan: "MONTHLY" | "YEARLY") {
    setPaying(plan);
    try {
      const res = await fetch("/api/seller/subscription/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        alert(data.message || "فشل الدفع");
        return;
      }
      
      alert("تم تجديد الاشتراك بنجاح!");
      loadStatus();
    } catch (e) {
      alert("حدث خطأ في الاتصال");
    } finally {
      setPaying(null);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" /></div>;

  const isActive = status?.subscriptionStatus === "ACTIVE" || (status?.subscriptionEndsAt && new Date(status.subscriptionEndsAt) > new Date());
  const endsAt = status?.subscriptionEndsAt ? new Date(status.subscriptionEndsAt).toLocaleDateString("ar-MA") : "غير مشترك";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-4xl mx-auto" dir="rtl">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black flex items-center justify-center gap-2">
          <CreditCard className="h-6 w-6 text-[#ff5c00]" />
          اشتراك نظام البيع في المحل
        </h1>
        <p className="text-sm text-gray-500 mt-2">ادفع من محفظتك لتفعيل الماسح ونقطة البيع</p>
      </div>

      {/* الحالة الحالية */}
      <div className={`mb-8 rounded-2xl p-6 text-center shadow-sm border ${isActive ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
        {isActive ? (
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
        ) : (
          <ShieldAlert className="h-12 w-12 text-red-600 mx-auto mb-2" />
        )}
        <h2 className="text-lg font-black">{isActive ? "اشتراكك نشط" : "اشتراكك منتهي"}</h2>
        <p className="text-sm mt-1">
          {isActive ? `صالح حتى: ${endsAt}` : "يرجى التجديد لاستخدام الماسح ونقطة البيع."}
        </p>
        <div className="mt-2 text-xs font-bold text-gray-600">
          رصيد محفظتك الحالي: {Number(status?.walletBalance || 0).toFixed(2)} د.م
        </div>
      </div>

      {/* الباقات */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-100 flex flex-col items-center text-center">
          <div className="font-black text-xl mb-2">الباقة الشهرية</div>
          <div className="text-3xl font-black text-[#ff5c00] mb-4">50 <span className="text-sm text-gray-500">د.م / شهر</span></div>
          <ul className="space-y-2 mb-6 text-sm font-bold text-gray-600 w-full">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> ماسح الباركود المستمر</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> طباعة الفواتير</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> إدارة المخزون المشترك</li>
          </ul>
          <button onClick={() => handlePay("MONTHLY")} disabled={paying !== null} className="w-full rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
            {paying === "MONTHLY" ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "دفع 50 د.م"}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md border-2 border-[#0a1f44] relative flex flex-col items-center text-center">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#0a1f44] text-white text-[10px] font-bold px-3 py-1 rounded-b-lg">توفير 40%</div>
          <div className="font-black text-xl mb-2 mt-2">الباقة السنوية</div>
          <div className="text-3xl font-black text-[#0a1f44] mb-4">350 <span className="text-sm text-gray-500">د.م / سنة</span></div>
          <ul className="space-y-2 mb-6 text-sm font-bold text-gray-600 w-full">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> كل ميزات الباقة الشهرية</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> توفير درهم شهرياً</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /> حماية من انقطاع الخدمة</li>
          </ul>
          <button onClick={() => handlePay("YEARLY")} disabled={paying !== null} className="w-full rounded-lg bg-[#0a1f44] py-3 text-sm font-bold text-white hover:bg-[#1a2f54] disabled:opacity-50">
            {paying === "YEARLY" ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "دفع 350 د.م"}
          </button>
        </div>
      </div>
    </div>
  );
}