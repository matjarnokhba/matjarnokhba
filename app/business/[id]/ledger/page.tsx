"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, BookOpen, TrendingUp, TrendingDown, Plus, X, CheckCircle2, XCircle, Clock } from "lucide-react";

type Account = {
  id: number;
  businessId: number;
  counterpartyBusinessId: number;
  balance: number;
  currency: string;
  lastActivityAt: string | null;
  counterparty: { id: number; name: string; slug: string; type: string; city: string; logo: string | null; status: string };
};

type PendingTx = {
  id: number;
  type: string;
  amount: number;
  debtorBusinessId: number;
  creditorBusinessId: number;
  notes: string | null;
  createdAt: string;
  debtor: { id: number; name: string };
  creditor: { id: number; name: string };
  createdBy: { id: number; name: string };
};

type Business = { id: number; name: string; type: string; status: string };

const TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة",
};
const TX_LABEL: Record<string, string> = {
  SALE: "بيع", PAYMENT: "دفعة", REFUND: "استرداد", ADJUSTMENT: "تسوية",
};

export default function LedgerPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pending, setPending] = useState<PendingTx[]>([]);
  const [error, setError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [counterparties, setCounterparties] = useState<Business[]>([]);

  const [cpId, setCpId] = useState<number | null>(null);
  const [direction, setDirection] = useState<"we_owe" | "they_owe">("they_owe");
  const [type, setType] = useState<"SALE" | "PAYMENT" | "REFUND" | "ADJUSTMENT">("SALE");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/ledger`);
      const d = await res.json();
      if (d.success) {
        setAccounts(d.accounts);
        setPending(d.pending);
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  async function loadCounterparties() {
    try {
      const res = await fetch("/api/business");
      const d = await res.json();
      if (d.success) {
        const others = (d.businesses || [])
          .filter((b: Business) => b.id !== bizId && b.status === "VERIFIED")
          .map((b: Business) => ({ id: b.id, name: b.name, type: b.type, status: b.status }));
        setCounterparties(others);
        if (others.length > 0 && !cpId) setCpId(others[0].id);
      }
    } catch {}
  }

  useEffect(() => { load(); }, [bizId]);

  useEffect(() => { if (showManual && counterparties.length === 0) loadCounterparties(); }, [showManual]);

  async function handleManual() {
    if (!cpId) return setError("اختر الطرف الآخر");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("المبلغ غير صحيح");
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/ledger/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counterpartyBusinessId: cpId, direction, type, amount: amt, notes: notes || null }),
      });
      const d = await res.json();
      if (d.success) { setShowManual(false); setAmount(""); setNotes(""); await load(); }
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setSubmitting(false); }
  }

  async function handleConfirm(txId: number, action: "confirm" | "reject") {
    try {
      const res = await fetch(`/api/business/${bizId}/ledger/transactions/${txId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.success) await load();
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
  }

  const totalReceivable = accounts.filter(a => Number(a.balance) > 0).reduce((s, a) => s + Number(a.balance), 0);
  const totalPayable = accounts.filter(a => Number(a.balance) < 0).reduce((s, a) => s + Math.abs(Number(a.balance)), 0);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6 text-orange-500" /> دفتر الحسابات</h1>
          <p className="text-sm text-gray-600">ديونك ومستحقاتك تجاه الأنشطة الأخرى</p>
        </div>
        <button onClick={() => setShowManual(true)} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 flex items-center gap-2">
          <Plus className="h-4 w-4" /> معاملة يدوية
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-5 w-5 text-green-600" /><p className="text-sm text-gray-600">مستحق لك</p></div>
          <p className="text-3xl font-bold text-green-600">{totalReceivable.toFixed(2)} <span className="text-lg">د.م</span></p>
        </div>
        <div className="rounded-xl bg-white border p-5">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-5 w-5 text-red-600" /><p className="text-sm text-gray-600">مستحق عليك</p></div>
          <p className="text-3xl font-bold text-red-600">{totalPayable.toFixed(2)} <span className="text-lg">د.م</span></p>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Clock className="h-5 w-5 text-amber-500" /> بانتظار التأكيد ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((tx) => {
              const iAmCreditor = tx.creditorBusinessId === bizId;
              const other = iAmCreditor ? tx.debtor.name : tx.creditor.name;
              return (
                <div key={tx.id} className="rounded-lg border bg-amber-50 p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{TX_LABEL[tx.type]} · {other}</p>
                      <p className="text-xs text-gray-600">{iAmCreditor ? "لك" : "عليك"} · <strong>{Number(tx.amount).toFixed(2)} د.م</strong></p>
                      {tx.notes && <p className="text-xs text-gray-500 mt-1">{tx.notes}</p>}
                      <p className="text-xs text-gray-500 mt-1">بواسطة {tx.createdBy.name}</p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button onClick={() => handleConfirm(tx.id, "confirm")} className="rounded bg-green-600 text-white px-2 py-1 text-xs hover:bg-green-700 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> تأكيد</button>
                      <button onClick={() => handleConfirm(tx.id, "reject")} className="rounded border border-red-300 text-red-600 px-2 py-1 text-xs hover:bg-red-50 flex items-center gap-1"><XCircle className="h-3 w-3" /> رفض</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl bg-white border p-12 text-center">
          <BookOpen className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">لا توجد معاملات بعد</p>
          <p className="text-xs text-gray-500 mt-2">ستُسجَّل تلقائيًا عند تسليم الطلبات</p>
        </div>
      ) : (
        <div className="rounded-xl bg-white border overflow-hidden">
          <h2 className="font-semibold p-4 border-b">الحسابات ({accounts.length})</h2>
          <div className="divide-y">
            {accounts.map((a) => {
              const bal = Number(a.balance);
              const isCredit = bal > 0;
              return (
                <Link key={a.id} href={`/business/${bizId}/ledger/${a.counterpartyBusinessId}`}
                  className="flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="h-12 w-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                    {a.counterparty.logo ? <img src={a.counterparty.logo} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-gray-400 text-xs">{a.counterparty.name.substring(0, 2)}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{a.counterparty.name}</p>
                    <p className="text-xs text-gray-500">{TYPE_LABEL[a.counterparty.type]} · {a.counterparty.city}</p>
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${isCredit ? "text-green-600" : bal < 0 ? "text-red-600" : "text-gray-500"}`}>
                      {bal > 0 ? "+" : ""}{bal.toFixed(2)} <span className="text-sm">د.م</span>
                    </p>
                    <p className="text-xs text-gray-500">{isCredit ? "لنا" : bal < 0 ? "علينا" : "متوازن"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {showManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">معاملة يدوية</h2>
              <button onClick={() => setShowManual(false)} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">الطرف الآخر</label>
              <select value={cpId ?? ""} onChange={(e) => setCpId(parseInt(e.target.value))} className="w-full rounded-lg border p-2">
                {counterparties.length === 0 && <option value="">لا يوجد نشاط متاح</option>}
                {counterparties.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">الاتجاه</label>
                <select value={direction} onChange={(e) => setDirection(e.target.value as any)} className="w-full rounded-lg border p-2">
                  <option value="they_owe">هم مدينون لنا</option>
                  <option value="we_owe">نحن مدينون لهم</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">النوع</label>
                <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full rounded-lg border p-2">
                  <option value="SALE">بيع/شراء</option>
                  <option value="PAYMENT">دفعة</option>
                  <option value="REFUND">استرداد</option>
                  <option value="ADJUSTMENT">تسوية</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">المبلغ</label>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ملاحظات</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">ستكون المعاملة "بانتظار التأكيد" حتى يعتمدها الطرف الآخر. لا تُحدَّث الأرصدة حتى التأكيد.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowManual(false)} className="rounded-lg border px-4 py-2 text-sm">إلغاء</button>
              <button onClick={handleManual} disabled={submitting || !cpId} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}