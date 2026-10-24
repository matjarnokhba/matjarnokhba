"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Package,
  Users,
  Crown,
  AlertTriangle,
  Building2,
} from "lucide-react";

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
  const [cashOwedToPlatform, setCashOwedToPlatform] = useState(0);
  const [cashOwedToDrivers, setCashOwedToDrivers] = useState(0);
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
          setCashOwedToPlatform(data.cashOwedToPlatform);
          setCashOwedToDrivers(data.cashOwedToDrivers);
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
        <p className="mt-1 text-sm text-gray-500">
          إدارة أموال الشحن والكاش المستلم من السائقين
        </p>
      </div>

      {/* ═══ تنبيه الكاش ═══ */}
      {cashInHand > 0 && (
        <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-400 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-black text-amber-900 text-lg">
                💰 لديك كاش في حوزتك: {cashInHand.toFixed(2)} د.م
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                هذا الكاش موزع كالتالي (يجب تسويته):
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                <li>
                  🏛️ <strong>{cashOwedToPlatform.toFixed(2)} د.م</strong> — أموال المنصة (تُسلَّم للأدمن)
                </li>
                <li>
                  👤 <strong>{cashOwedToDrivers.toFixed(2)} د.م</strong> — مستحقات السائقين (تُدفع لهم)
                </li>
                <li>
                  💵 <strong>{balance.toFixed(2)} د.م</strong> — ربحك الصافي (لك)
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ═══ بطاقات الرصيد الأربعة ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* الكاش الكلي */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Banknote className="h-5 w-5" />
            <p className="text-xs font-bold text-red-100">كاش في حوزتي</p>
          </div>
          <div className="text-3xl font-black">{cashInHand.toFixed(2)}</div>
          <p className="mt-1 text-[10px] text-red-100">د.م</p>
        </div>

        {/* أموال المنصة */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="h-5 w-5" />
            <p className="text-xs font-bold text-blue-100">أموال المنصة</p>
          </div>
          <div className="text-3xl font-black">{cashOwedToPlatform.toFixed(2)}</div>
          <p className="mt-1 text-[10px] text-blue-100">تُسلَّم للأدمن</p>
        </div>

        {/* مستحقات السائقين */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5" />
            <p className="text-xs font-bold text-amber-100">مستحقات السائقين</p>
          </div>
          <div className="text-3xl font-black">{cashOwedToDrivers.toFixed(2)}</div>
          <p className="mt-1 text-[10px] text-amber-100">تُدفع للسائقين</p>
        </div>

        {/* ربح المستودع */}
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-5 w-5" />
            <p className="text-xs font-bold text-teal-100">ربحي الصافي</p>
          </div>
          <div className="text-3xl font-black">{balance.toFixed(2)}</div>
          <p className="mt-1 text-[10px] text-teal-100">من فرق الشحن والإرجاع</p>
        </div>
      </div>

      {/* ═══ أزرار الإجراءات ═══ */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <a
          href="/warehouse/driver-payouts"
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700"
        >
          <Users className="h-4 w-4" />
          دفع أجور السائقين ({cashOwedToDrivers.toFixed(0)} د.م)
        </a>

        <a
          href="/warehouse/handover"
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Building2 className="h-4 w-4" />
          تحويل أموال المنصة ({cashOwedToPlatform.toFixed(0)} د.م)
        </a>
      </div>

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
              <div
                key={tx.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      Number(tx.amount) >= 0
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {Number(tx.amount) >= 0 ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">
                      {tx.description}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {new Date(tx.createdAt).toLocaleString("ar-MA")}
                    </div>
                  </div>
                </div>
                <div
                  className={`text-sm font-black ${
                    Number(tx.amount) >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                  dir="ltr"
                >
                  {Number(tx.amount) >= 0 ? "+" : ""}
                  {Number(tx.amount).toFixed(2)} د.م
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}