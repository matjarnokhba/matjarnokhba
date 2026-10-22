"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, ArrowDownLeft, ArrowUpRight, Crown, CreditCard } from "lucide-react";

type Transaction = {
  id: number;
  amount: string;
  type: string;
  description: string;
  createdAt: string;
};

export default function AdminWalletPage() {
  const [balance, setBalance] = useState(0);
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
          محفظة المنصة (الأرباح)
        </h1>
        <p className="mt-1 text-sm text-gray-500">التحكم في الإيرادات والعمولات الخاصة بمتجر نخبة</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        {/* رصيد العمولات */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-300">رصيد العمولات (10%)</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">{balance.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-gray-400">محصلة من مبيعات التجار</p>
          </div>
          <Wallet className="absolute -bottom-4 -left-4 h-32 w-32 text-white/5 rotate-12" />
        </div>

        {/* إيرادات الاشتراكات */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff5c00] to-[#e64a00] p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <p className="text-sm font-medium text-orange-100">إيرادات الاشتراكات</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">{subRevenue.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-orange-100">مدفوعة من التجار لنظام البيع</p>
          </div>
          <CreditCard className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex justify-between items-center">
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
                <div className="text-sm font-black text-green-600" dir="ltr">
                  +{Number(tx.amount).toFixed(2)} د.م
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}