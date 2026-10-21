"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, ArrowRight, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";

type Transaction = {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
};

export default function CustomerWalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/wallet");
        const data = await res.json();
        if (data.success) {
          setBalance(data.balance);
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
    <div className="min-h-screen bg-gray-50 pb-20 pt-16 lg:pt-8" dir="rtl">
      <div className="mx-auto max-w-2xl px-4">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-1 text-sm font-bold text-gray-500 transition hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للملف الشخصي
        </Link>

        {/* بطاقة الرصيد */}
        <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-green-500 to-emerald-700 p-8 text-white shadow-xl relative">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-black/10 blur-2xl"></div>
          
          <div className="relative z-10 flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Wallet className="h-5 w-5" />
            </div>
            <h1 className="text-lg font-bold">محفظة نخبة</h1>
          </div>
          
          <div className="relative z-10 mt-6">
            <p className="text-sm font-medium text-green-100 opacity-90">الرصيد المتاح</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-black tracking-tight">{balance.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
          </div>
        </div>

        {/* سجل الحركات */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-black text-gray-900">سجل العمليات</h2>
          </div>
          
          {transactions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-5xl mb-3">💸</div>
              <p className="text-sm font-bold text-gray-500">لا توجد عمليات سابقة</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${Number(tx.amount) > 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                      {Number(tx.amount) > 0 ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{tx.description}</div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {new Date(tx.createdAt).toLocaleString("ar-MA")}
                      </div>
                    </div>
                  </div>
                  <div className={`text-sm font-black ${Number(tx.amount) > 0 ? "text-green-600" : "text-red-600"}`} dir="ltr">
                    {Number(tx.amount) > 0 ? "+" : ""}{Number(tx.amount).toFixed(2)} د.م
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-xl bg-blue-50 p-4 border border-blue-100 flex items-start gap-3">
          <div className="text-blue-500 mt-0.5">💡</div>
          <p className="text-xs text-blue-800 leading-relaxed">
            يمكنك استخدام رصيد محفظتك في أي عملية شراء قادمة من خلال صفحة الدفع، أو يمكنك طلب استرداده نقداً (تحويل بنكي) عبر التواصل مع خدمة العملاء إذا تجاوز الرصيد 100 درهم.
          </p>
        </div>
      </div>
    </div>
  );
}