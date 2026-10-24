"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Truck,
  AlertTriangle,
  Banknote,
  Clock,
  Package,
} from "lucide-react";

type Transaction = {
  id: number;
  amount: string;
  type: string;
  description: string;
  createdAt: string;
};

type LegalNotice = {
  id: number;
  amountOwed: string;
  deadlineAt: string;
  status: string;
};

export default function DeliveryWalletPage() {
  const [balance, setBalance] = useState(0);
  const [cashInHand, setCashInHand] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [cashHeldHours, setCashHeldHours] = useState(0);
  const [pendingRefusedCount, setPendingRefusedCount] = useState(0);
  const [pendingRefusedOver24hCount, setPendingRefusedOver24hCount] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [legalNotices, setLegalNotices] = useState<LegalNotice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/delivery/wallet");
        const data = await res.json();
        if (data.success) {
          setBalance(data.balance);
          setCashInHand(data.cashInHand);
          setIsBlocked(data.isBlocked);
          setBlockReason(data.blockReason || null);
          setCashHeldHours(data.cashHeldHours || 0);
          setPendingRefusedCount(data.pendingRefusedCount || 0);
          setPendingRefusedOver24hCount(data.pendingRefusedOver24hCount || 0);
          setTransactions(data.transactions);
          setLegalNotices(data.legalNotices || []);
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
        <Loader2 className="h-10 w-10 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Wallet className="h-6 w-6 text-green-600" />
          محفظتي
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          أرباحك وعمولاتك من عمليات التوصيل
        </p>
      </div>

      {/* ═══ حظر (بعد 24 ساعة) ═══ */}
      {isBlocked && (
        <div className="mb-4 rounded-2xl bg-red-50 border-2 border-red-500 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-black text-red-900 text-lg">🚫 حسابك موقوف مؤقتاً</h3>
              <p className="mt-1 text-sm text-red-800">{blockReason}</p>
              <p className="mt-2 text-xs text-red-700">
                لا يمكنك استلام شحنات جديدة أو سحب الأموال حتى تسوية الوضع.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ تنبيه بضاعة مرفوضة (قبل 24 ساعة) ═══ */}
      {!isBlocked && pendingRefusedCount > 0 && (
        <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 p-5">
          <div className="flex items-start gap-3">
            <Package className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-black text-amber-900 text-base">
                📦 لديك {pendingRefusedCount} منتج مرفوض بانتظار الإرجاع
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                يجب إرجاعها للمستودع خلال 24 ساعة لتجنب إيقاف الحساب.
              </p>
              <p className="mt-2 text-xs text-amber-700">
                ⏰ بعد الإرجاع، سيُرفع الإيقاف تلقائياً.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ تنبيه كاش (قبل 24 ساعة) ═══ */}
      {!isBlocked && cashInHand > 0 && (
        <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 p-5">
          <div className="flex items-start gap-3">
            <Banknote className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <h3 className="font-black text-amber-900 text-base">
                💰 لديك كاش في حوزتك يجب تسليمه
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                المبلغ: <strong>{cashInHand.toFixed(2)} د.م</strong>
                {cashHeldHours > 0 && ` (منذ ${cashHeldHours} ساعة)`}
              </p>
              <p className="mt-2 text-xs text-amber-700">
                ⏰ سيتم إيقاف حسابك تلقائياً إذا لم تسلّم المبلغ خلال 24 ساعة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ الإنذارات القانونية ═══ */}
      {legalNotices.map((notice) => {
        const deadline = new Date(notice.deadlineAt);
        const daysLeft = Math.ceil(
          (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return (
          <div key={notice.id} className="mb-4 rounded-2xl bg-red-50 border-2 border-red-600 p-5">
            <div className="flex items-start gap-3">
              <Clock className="h-8 w-8 text-red-600 shrink-0" />
              <div className="flex-1">
                <h3 className="font-black text-red-900 text-lg">⚠️ إنذار قانوني نهائي</h3>
                <p className="mt-1 text-sm text-red-800">
                  مبلغ مستحق للمنصة:{" "}
                  <strong className="text-xl">{Number(notice.amountOwed).toFixed(2)} د.م</strong>
                </p>
                <p className="mt-2 text-sm font-bold text-red-900">
                  المتبقي على المهلة:{" "}
                  {daysLeft > 0 ? `${daysLeft} يوم` : "انتهت المهلة"}
                </p>
                <p className="mt-2 text-xs text-red-700">
                  {daysLeft > 0
                    ? "يرجى تسوية المستحقات قبل انتهاء المهلة لتجنب الإجراءات القانونية."
                    : "انتهت المهلة. سيتم رفع دعوى قضائية ضدك إن لم يتم السداد فوراً."}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {/* ═══ البطاقات ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-lg relative">
          <div className="relative z-10">
            <p className="text-sm font-medium text-green-100">أرباحي المستحقة</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">{balance.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] text-green-100">
              {isBlocked ? "🔒 محجوز حتى تسوية الوضع" : "✓ متاح للسحب (كل يوم سبت)"}
            </p>
          </div>
          <Truck className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>

        <div
          className={`overflow-hidden rounded-2xl p-6 text-white shadow-lg relative ${
            cashInHand > 0
              ? "bg-gradient-to-br from-red-500 to-red-700"
              : "bg-gradient-to-br from-gray-500 to-gray-700"
          }`}
        >
          <div className="relative z-10">
            <p className="text-sm font-medium opacity-90">كاش في حوزتي</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black">{cashInHand.toFixed(2)}</span>
              <span className="mb-1 text-lg font-bold opacity-80">د.م</span>
            </div>
            <p className="mt-3 text-[11px] opacity-90">
              {cashInHand > 0 ? "⚠️ يجب تسليمه للمستودع" : "✓ لا يوجد كاش في حوزتك"}
            </p>
          </div>
          <Banknote className="absolute -bottom-4 -left-4 h-32 w-32 text-white/10 rotate-12" />
        </div>
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
                    <div className="text-sm font-bold text-gray-900">{tx.description}</div>
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