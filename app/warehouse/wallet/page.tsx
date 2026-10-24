"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet, ArrowDownLeft, ArrowUpRight, Banknote, Package, Users, AlertTriangle } from "lucide-react";

type Transaction = {
  id: number;
  amount: string;
  type: string;
  description: string;
  createdAt: string;
};

export default function WarehouseWalletPage() {
  const [balance, setBalance] = useState(0);
  const [cashInHand, setCashInHand] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/warehouse/wallet");
        const data = await res.json();
        if (data.success) {
          setBalance(data.balance);
          setCashInHand(data.cashInHand);
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
        <Loader2 className="h-10 w-10 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Wallet className="h-6 w-6 text-teal-600" />
          محفظة المستودع
        </h1>
        <p className="mt-1 text-sm text-gray-500">إدارة أموال الشحن والكاش المستلم من السائقين</p>
      </div>

      {/* ═══ تحذير إذا كان هناك كاش بحوزته ═══ */}
      {cashInHand > 0 && (
        <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-500 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-black text-amber-900 text-lg">⚠️ لديك كاش يجب تسليمه للأدمن</h3>
              <p className="mt-1 text-sm text-amber-800">
                مبلغ <strong className="text-2xl">{cashInHand.toFixed(2)} د.م</strong> في حوزتك، يجب تسليمه للأدمن.
              </p>
              <p className="mt-2 text-xs text-amber-700">
                هذا المبلغ لا يخصك، فهو يشمل: ثمن المنتجات (للتجار) + أموال السائقين + رسوم الإرجاع.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ بطاقات الرصيد ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        {/* الربح الصافي */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <p className="text-sm font-medium text-teal-100">أرباحي الصافية</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">{balance.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-teal-100">من فرق الشحن + رسوم الإرجاع</p>
          </div>
          <Banknote className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>

        {/* الكاش في الحوزة */}
        <div className={`overflow-hidden rounded-2xl p-6 text-white shadow-lg relative ${cashInHand > 0 ? "bg-gradient-to-br from-red-500 to-red-700" : "bg-gradient-to-br from-gray-500 to-gray-700"}`}>
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-90">كاش في حوزتي</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">{cashInHand.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] opacity-90">
              {cashInHand > 0 ? "⚠️ يجب تسليمه للأدمن" : "✓ لا يوجد كاش بحوزتك"}
            </p>
          </div>
          <Wallet className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>
      </div>

      {/* ═══ تفصيل الكاش في الحوزة ═══ */}
      {cashInHand > 0 && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <h2 className="mb-4 text-sm font-black flex items-center gap-2">
            <Package className="h-4 w-4 text-teal-600" />
            تفصيل المبلغ الذي في حوزتك
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 border border-blue-100">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                <span className="text-sm font-bold text-blue-900">ثمن المنتجات (للتجار)</span>
              </div>
              <span className="text-base font-black text-blue-700">يُسلَّم للأدمن</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-green-50 p-3 border border-green-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                <span className="text-sm font-bold text-green-900">أجور السائقين (13 د.م × عدد التوصيلات)</span>
              </div>
              <span className="text-base font-black text-green-700">تُسلَّم للسائقين</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-teal-50 p-3 border border-teal-100">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-teal-600" />
                <span className="text-sm font-bold text-teal-900">رسوم الإرجاع (15 د.م)</span>
              </div>
              <span className="text-base font-black text-teal-700">تُضاف لأرباحك</span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-500 text-center">
            المبلغ {cashInHand.toFixed(2)} د.م سيتوزع تلقائياً عند تسليمه للأدمن
          </p>
        </div>
      )}

      {/* ═══ سجل الحركات ═══ */}
      <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-black text-gray-900">سجل الحركات</h2>
        </div>
        
        {transactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-gray-500">لا توجد حركات مالية بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${Number(tx.amount) >= 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                    {Number(tx.amount) >= 0 ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
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