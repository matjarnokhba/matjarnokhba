"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, ArrowDownLeft, Crown, CreditCard, Users, ShieldCheck, Banknote } from "lucide-react";

type Transaction = {
  id: number;
  amount: string;
  type: string;
  description: string;
  createdAt: string;
};

export default function AdminWalletPage() {
  const [balance, setBalance] = useState(0);
  const [heldBalance, setHeldBalance] = useState(0);
  const [cashInHand, setCashInHand] = useState(0);
  const [subRevenue, setSubRevenue] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/wallet");
        const data = await res.json();
        if (data.success) {
          setBalance(data.balance);
          setHeldBalance(data.heldBalance);
          setCashInHand(data.cashInHand);
          setSubRevenue(data.subscriptionRevenue);
          setTransactions(data.transactions);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Crown className="h-6 w-6 text-amber-500" />
          محفظة المنصة
        </h1>
        <p className="mt-1 text-sm text-gray-500">أرباحك الصافية + أمانات التجار + الكاش المستلم</p>
      </div>

      {/* ═══ تنبيه محاسبي مهم ═══ */}
      <div className="mb-4 rounded-2xl bg-blue-50 border-2 border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-black text-blue-900 text-sm">محفظتك مقسمة إلى ثلاثة أقسام</h3>
            <p className="mt-1 text-xs text-blue-800">
              <strong>الأرباح:</strong> أموالك الصافية (عمولات + اشتراكات + رسوم إرجاع).
              <br />
              <strong>أمانات التجار:</strong> أموال التجار بأمانة عندك، تُدفع لهم عند طلب السحب.
              <br />
              <strong>كاش في اليد:</strong> مستلم من المستودع، مخصص لدفع مستحقات التجار.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ بطاقات الرصيد (3 بطاقات) ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {/* أرباح المنصة */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5" />
              <p className="text-sm font-bold text-amber-100">أرباحي الصافية</p>
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-black">{balance.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-amber-100">
              عمولات + اشتراكات + رسوم إرجاع
            </p>
          </div>
          <Wallet className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>

        {/* أمانات التجار */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5" />
              <p className="text-sm font-bold text-blue-100">أمانات التجار</p>
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-black">{heldBalance.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-blue-100">
              ⚠️ هذه أموال التجار - تُدفع عند طلب السحب
            </p>
          </div>
          <ShieldCheck className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>

        {/* كاش في اليد */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-green-700 p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="h-5 w-5" />
              <p className="text-sm font-bold text-green-100">كاش في اليد</p>
            </div>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-black">{cashInHand.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-green-100">مخصص لدفع مستحقات التجار</p>
          </div>
        </div>
      </div>

      {/* ═══ إيرادات الاشتراكات (تفصيل) ═══ */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
          <CreditCard className="h-4 w-4 text-[#ff5c00]" />
          تفصيل الإيرادات
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500 font-bold">إيرادات الاشتراكات</div>
            <div className="mt-1 text-xl font-black text-gray-900">{subRevenue.toFixed(2)} د.م</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500 font-bold">عمولات المبيعات</div>
            <div className="mt-1 text-xl font-black text-gray-900">{Math.max(0, balance - subRevenue).toFixed(2)} د.م</div>
          </div>
        </div>
      </div>

      {/* ═══ سجل الحركات ═══ */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-black text-gray-900">سجل العمولات</h2>
        </div>
        
        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-gray-500">لا توجد عمولات مسجلة بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <ArrowDownLeft className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{tx.description}</div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {new Date(tx.createdAt).toLocaleString("ar-MA")}
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-black ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"}`} dir="ltr">
                  {Number(tx.amount) >= 0 ? "+" : ""}{Number(tx.amount).toFixed(2)} د.م
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}