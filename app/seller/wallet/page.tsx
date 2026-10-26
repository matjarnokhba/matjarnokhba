"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  X,
} from "lucide-react";

type WalletData = {
  walletBalance: number;
  heldBalance: number;
  totalRevenue: number;
  totalCommission: number;
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

type Withdrawal = {
  id: number;
  amount: number;
  status: string;
  requestedAt: string;
  adminNote: string | null;
};

export default function SellerWalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadWallet() {
    try {
      const res = await fetch("/api/seller/wallet");
      const json = await res.json();
      if (json.success) {
        setData({
          walletBalance: Number(json.seller.walletBalance),
          heldBalance: Number(json.seller.heldBalance),
          totalRevenue: Number(json.seller.totalRevenue),
          totalCommission: Number(json.seller.totalCommission),
        });
        setTransactions(json.transactions);
        setWithdrawals(json.withdrawals);
        setIsOwner(json.isSellerOwner === true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/seller/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          bankDetails: {
            method,
            accountName,
            accountNumber,
            bankName: method === "bank" ? bankName : undefined,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "فشل طلب السحب");
        return;
      }

      setShowModal(false);
      setAmount("");
      loadWallet();
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Wallet className="h-6 w-6 text-[#ff5c00]" />
            محفظتي
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة أرباحك وطلبات السحب
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#e64a00]"
          >
            <ArrowDownToLine className="h-4 w-4" />
            طلب سحب
          </button>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-green-600 p-5 text-white shadow-md">
          <div className="text-xs font-bold text-green-100">الرصيد المتاح</div>
          <div className="mt-2 text-3xl font-black">
            {data.walletBalance.toFixed(2)} <span className="text-sm">د.م</span>
          </div>
          <div className="mt-1 text-[10px] text-green-100">جاهز للسحب</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 p-5 text-white shadow-md">
          <div className="text-xs font-bold text-amber-50">الرصيد المحجوز</div>
          <div className="mt-2 text-3xl font-black">
            {data.heldBalance.toFixed(2)} <span className="text-sm">د.م</span>
          </div>
          <div className="mt-1 text-[10px] text-amber-50">يُفرج عنه بعد 3 أيام</div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="text-xs font-bold text-gray-500">إجمالي المبيعات</div>
          <div className="mt-2 text-2xl font-black text-gray-900">
            {data.totalRevenue.toFixed(2)} <span className="text-sm">د.م</span>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100">
          <div className="text-xs font-bold text-gray-500">إجمالي العمولات</div>
          <div className="mt-2 text-2xl font-black text-red-600">
            {data.totalCommission.toFixed(2)} <span className="text-sm">د.م</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-gray-900">
              <TrendingUp className="h-4 w-4 text-[#ff5c00]" />
              سجل الحركات المالية
            </h2>
            {transactions.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                لا توجد حركات مالية بعد
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-bold text-gray-900">
                        {tx.description}
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {new Date(tx.createdAt).toLocaleString("ar-MA")}
                      </div>
                    </div>
                    <div
                      className={`text-sm font-black ${
                        Number(tx.amount) > 0 ? "text-green-600" : "text-red-600"
                      }`}
                      dir="ltr"
                    >
                      {Number(tx.amount) > 0 ? "+" : ""}
                      {Number(tx.amount).toFixed(2)} د.م
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-gray-900">
              <Clock className="h-4 w-4 text-[#ff5c00]" />
              طلبات السحب
            </h2>
            {withdrawals.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                لا توجد طلبات سحب
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((w) => (
                  <div key={w.id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-gray-900">
                        {Number(w.amount).toFixed(2)} د.م
                      </div>
                      {w.status === "PENDING" && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          قيد المراجعة
                        </span>
                      )}
                      {w.status === "PAID" && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          تم التحويل
                        </span>
                      )}
                      {w.status === "REJECTED" && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          مرفوض
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-gray-500">
                      {new Date(w.requestedAt).toLocaleDateString("ar-MA")}
                    </div>
                    {w.adminNote && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-2 text-[10px] text-gray-600">
                        ملاحظة: {w.adminNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isOwner && showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">طلب سحب أرباح</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 hover:bg-gray-100"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                يتم تحويل المبالغ كل يوم <strong>سبت</strong>. الرصيد المتاح للسحب:{" "}
                <strong>{data.walletBalance.toFixed(2)} د.م</strong>
              </p>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  المبلغ المطلوب (د.م)
                </label>
                <input
                  type="number"
                  required
                  min="20"
                  max={data.walletBalance}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  طريقة الاستلام
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                >
                  <option value="bank">تحويل بنكي (RIB)</option>
                  <option value="wafacash">وافاكاش</option>
                  <option value="cashplus">كاش بلوس</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                />
              </div>

              {method === "bank" && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    اسم البنك
                  </label>
                  <input
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  {method === "bank" ? "رقم الحساب (RIB)" : "رقم الهاتف"}
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                />
              </div>

              {error && (
                <div className="rounded bg-red-50 p-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تأكيد طلب السحب
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}