"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, BookOpen, TrendingUp, TrendingDown } from "lucide-react";

type Account = {
  id: number;
  balance: number;
  currency: string;
  counterparty: { id: number; name: string; slug: string; type: string; city: string; logo: string | null; status: string };
};

type Transaction = {
  id: number;
  type: string;
  status: string;
  amount: number;
  debtorBusinessId: number;
  creditorBusinessId: number;
  orderId: number | null;
  notes: string | null;
  createdAt: string;
  order: { id: number; orderNumber: string } | null;
  createdBy: { id: number; name: string };
  confirmedBy: { id: number; name: string } | null;
  rejectionReason: string | null;
};

const TX_LABEL: Record<string, string> = { SALE: "بيع", PAYMENT: "دفعة", REFUND: "استرداد", ADJUSTMENT: "تسوية" };
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  CONFIRMED: { label: "مؤكدة", color: "bg-green-100 text-green-700" },
  PENDING: { label: "معلقة", color: "bg-amber-100 text-amber-700" },
  REJECTED: { label: "مرفوضة", color: "bg-red-100 text-red-700" },
};
const TYPE_LABEL: Record<string, string> = { FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة" };

export default function LedgerAccountPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);
  const cpId = parseInt(params.counterpartyId as string);

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/business/${bizId}/ledger/${cpId}`);
        const d = await res.json();
        if (d.success) { setAccount(d.account); setTransactions(d.transactions); }
        else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, cpId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!account) return <div className="max-w-4xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "الحساب غير موجود"}</div></div>;

  const bal = Number(account.balance);
  const isCredit = bal > 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/ledger`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-orange-500" /> كشف حساب</h1>
          <p className="text-sm text-gray-600">{account.counterparty.name}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-14 w-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            {account.counterparty.logo ? <img src={account.counterparty.logo} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400 text-sm">{account.counterparty.name.substring(0, 2)}</div>}
          </div>
          <div>
            <p className="font-semibold">{account.counterparty.name}</p>
            <p className="text-xs text-gray-500">{TYPE_LABEL[account.counterparty.type]} · {account.counterparty.city}</p>
          </div>
        </div>
        <div className={`rounded-lg p-4 ${isCredit ? "bg-green-50 border border-green-200" : bal < 0 ? "bg-red-50 border border-red-200" : "bg-gray-50 border"}`}>
          <div className="flex items-center gap-2 mb-1">
            {isCredit ? <TrendingUp className="h-5 w-5 text-green-600" /> : bal < 0 ? <TrendingDown className="h-5 w-5 text-red-600" /> : null}
            <p className="text-sm text-gray-600">{isCredit ? "مستحق لك" : bal < 0 ? "مستحق عليك" : "الرصيد"}</p>
          </div>
          <p className={`text-3xl font-bold ${isCredit ? "text-green-600" : bal < 0 ? "text-red-600" : "text-gray-500"}`}>
            {Math.abs(bal).toFixed(2)} <span className="text-lg">د.م</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white border p-5">
        <h2 className="font-semibold mb-3">سجل المعاملات ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">لا توجد معاملات بعد</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const iAmCreditor = tx.creditorBusinessId === bizId;
              const st = STATUS_LABEL[tx.status] || STATUS_LABEL.CONFIRMED;
              return (
                <div key={tx.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{TX_LABEL[tx.type]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${st.color}`}>{st.label}</span>
                        {tx.order && <span className="text-xs text-gray-500 font-mono">{tx.order.orderNumber}</span>}
                      </div>
                      {tx.notes && <p className="text-xs text-gray-600 mt-1">{tx.notes}</p>}
                      <p className="text-xs text-gray-500 mt-1">{new Date(tx.createdAt).toLocaleString("ar-MA")} · بواسطة {tx.createdBy.name}</p>
                      {tx.rejectionReason && <p className="text-xs text-red-600 mt-1">سبب الرفض: {tx.rejectionReason}</p>}
                    </div>
                    <div className="text-left">
                      <p className={`font-bold text-base ${iAmCreditor ? "text-green-600" : "text-red-600"}`}>
                        {iAmCreditor ? "+" : "-"}{Number(tx.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-500">{iAmCreditor ? "لك" : "عليك"}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}