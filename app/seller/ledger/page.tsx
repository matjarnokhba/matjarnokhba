"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Search, X, Trash2, Wallet, ArrowDownRight, ArrowUpRight,
  TrendingUp, TrendingDown, FileText, User, Users,
} from "lucide-react";

type Entry = {
  id: number;
  counterpartyType: string;
  counterpartyUserId: number | null;
  counterpartyName: string;
  entryType: string;
  amount: number;
  currency: string;
  description: string;
  entryDate: string;
  dueDate: string | null;
  notes: string | null;
  referenceNumber: string | null;
};

type Party = { name: string; type: string; userId: number | null; balance: number; count: number };
type Overview = { totalReceivable: number; totalPayable: number; netBalance: number; entriesCount: number; parties: Party[] };

const ENTRY_LABEL: Record<string, { label: string; sign: 1 | -1; color: string }> = {
  SALE: { label: "بيع بالأجل", sign: 1, color: "text-green-700 bg-green-50" },
  PURCHASE: { label: "شراء بالأجل", sign: -1, color: "text-red-700 bg-red-50" },
  PAYMENT_RECEIVED: { label: "استلمت دفعة", sign: -1, color: "text-blue-700 bg-blue-50" },
  PAYMENT_SENT: { label: "أرسلت دفعة", sign: 1, color: "text-purple-700 bg-purple-50" },
};

function fmt(n: number) { return n.toFixed(2); }

export default function LedgerPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterType) params.set("entryType", filterType);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const [r1, r2] = await Promise.all([
        fetch(`/api/seller/ledger?${params.toString()}`),
        fetch("/api/seller/ledger/overview"),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      if (d1.success) setEntries(d1.items);
      else setError(d1.message);
      if (d2.success) setOverview(d2);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }, [search, filterType, from, to]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا القيد؟")) return;
    try {
      const r = await fetch(`/api/seller/ledger/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (d.success) load();
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">كناش الديون</h1>
          <p className="text-sm text-gray-600">تتبع معاملاتك مع الأطراف داخل وخارج المنصة</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-orange-500 px-4 py-2 text-white font-medium hover:bg-orange-600 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> قيد جديد
        </button>
      </div>

      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 text-green-700">
              <ArrowDownRight className="h-4 w-4" />
              <span className="text-xs font-semibold">المستحق لي</span>
            </div>
            <p className="text-2xl font-black mt-2 text-green-700">{fmt(overview.totalReceivable)} د.م</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 text-red-700">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs font-semibold">المستحق عليّ</span>
            </div>
            <p className="text-2xl font-black mt-2 text-red-700">{fmt(overview.totalPayable)} د.م</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 text-gray-700">
              {overview.netBalance >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-xs font-semibold">الصافي</span>
            </div>
            <p className={`text-2xl font-black mt-2 ${overview.netBalance >= 0 ? "text-green-700" : "text-red-700"}`}>
              {overview.netBalance >= 0 ? "+" : ""}{fmt(overview.netBalance)} د.م
            </p>
            <p className="text-xs text-gray-500 mt-1">{overview.entriesCount} قيد · {overview.parties.length} طرف</p>
          </div>
        </div>
      )}

      {overview && overview.parties.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> أرصدة الأطراف (أعلى 10)</h2>
          <div className="space-y-2">
            {overview.parties.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-gray-500" />
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-[10px] text-gray-500">{p.type === "INTERNAL" ? "داخلي" : "خارجي"} · {p.count} قيد</span>
                </div>
                <span className={`text-sm font-bold ${p.balance > 0 ? "text-green-700" : p.balance < 0 ? "text-red-700" : "text-gray-600"}`}>
                  {p.balance > 0 ? "+" : ""}{fmt(p.balance)} د.م
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="ابحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border pr-8 pl-2 py-2 text-sm" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="rounded border px-2 py-2 text-sm">
            <option value="">كل الأنواع</option>
            <option value="SALE">بيع بالأجل</option>
            <option value="PURCHASE">شراء بالأجل</option>
            <option value="PAYMENT_RECEIVED">استلمت دفعة</option>
            <option value="PAYMENT_SENT">أرسلت دفعة</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-2 py-2 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-2 py-2 text-sm" />
        </div>

        {error && <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>لا توجد قيود بعد. اضغط "قيد جديد" للبدء.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-xs text-gray-600">
                <tr>
                  <th className="text-right py-2">التاريخ</th>
                  <th className="text-right py-2">النوع</th>
                  <th className="text-right py-2">الطرف</th>
                  <th className="text-right py-2">الوصف</th>
                  <th className="text-right py-2">المبلغ</th>
                  <th className="text-right py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const meta = ENTRY_LABEL[e.entryType] || { label: e.entryType, sign: 1, color: "text-gray-700 bg-gray-50" };
                  const signed = meta.sign * e.amount;
                  return (
                    <tr key={e.id} className="border-b hover:bg-gray-50">
                      <td className="py-2 text-xs text-gray-600">{new Date(e.entryDate).toLocaleDateString("ar-MA")}</td>
                      <td className="py-2"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span></td>
                      <td className="py-2">{e.counterpartyName}</td>
                      <td className="py-2 text-xs text-gray-600 max-w-[200px] truncate">{e.description}</td>
                      <td className={`py-2 font-bold ${signed > 0 ? "text-green-700" : "text-red-700"}`}>
                        {signed > 0 ? "+" : ""}{fmt(signed)} د.م
                      </td>
                      <td className="py-2 text-left">
                        <button onClick={() => handleDelete(e.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <NewEntryModal onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function NewEntryModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [cpType, setCpType] = useState<"EXTERNAL" | "INTERNAL">("EXTERNAL");
  const [cpName, setCpName] = useState("");
  const [cpUserId, setCpUserId] = useState<number | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [entryType, setEntryType] = useState("SALE");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cpType !== "INTERNAL" || userQuery.length < 2) { setUserResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/seller/ledger/search-users?q=${encodeURIComponent(userQuery)}`);
        const d = await r.json();
        if (d.success) setUserResults(d.users);
      } catch {}
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery, cpType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const amt = Number(amount);
      if (isNaN(amt) || amt <= 0) throw new Error("المبلغ غير صالح");
      if (cpType === "INTERNAL" && !cpUserId) throw new Error("اختر مستخدمًا");
      if (cpType === "EXTERNAL" && cpName.trim().length < 1) throw new Error("أدخل اسم الطرف");

      const payload = {
        counterpartyType: cpType,
        counterpartyUserId: cpType === "INTERNAL" ? cpUserId : null,
        counterpartyName: cpType === "INTERNAL" ? (userResults.find((u) => u.id === cpUserId)?.name || "") : cpName.trim(),
        entryType, amount: amt, description: description.trim(),
        entryDate: entryDate || null, dueDate: dueDate || null,
        notes: notes.trim() || null, referenceNumber: referenceNumber.trim() || null,
      };

      const r = await fetch("/api/seller/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.success) onSuccess();
      else { setError(d.message || "فشل الحفظ"); setSaving(false); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 my-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">قيد جديد</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">نوع الطرف</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCpType("EXTERNAL"); setCpUserId(null); }}
                className={`flex-1 rounded-lg border-2 p-2 text-sm ${cpType === "EXTERNAL" ? "border-orange-500 bg-orange-50" : "border-gray-200"}`}>
                خارج المنصة
              </button>
              <button type="button" onClick={() => { setCpType("INTERNAL"); setCpName(""); }}
                className={`flex-1 rounded-lg border-2 p-2 text-sm ${cpType === "INTERNAL" ? "border-orange-500 bg-orange-50" : "border-gray-200"}`}>
                مستخدم داخلي
              </button>
            </div>
          </div>

          {cpType === "EXTERNAL" ? (
            <input type="text" placeholder="اسم الطرف *" value={cpName} onChange={(e) => setCpName(e.target.value)}
              required className="w-full rounded border p-2 text-sm" />
          ) : (
            <div>
              <input type="text" placeholder="ابحث بالاسم أو البريد..." value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
                className="w-full rounded border p-2 text-sm" />
              {searching && <p className="text-xs text-gray-500 mt-1">جارٍ البحث...</p>}
              {userResults.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto border rounded divide-y">
                  {userResults.map((u) => (
                    <button key={u.id} type="button" onClick={() => { setCpUserId(u.id); setUserQuery(u.name); setUserResults([]); }}
                      className={`w-full text-right px-3 py-2 text-sm hover:bg-orange-50 ${cpUserId === u.id ? "bg-orange-100" : ""}`}>
                      {u.name} <span className="text-xs text-gray-500">({u.email})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">نوع القيد *</label>
            <select value={entryType} onChange={(e) => setEntryType(e.target.value)} className="w-full rounded border p-2 text-sm">
              <option value="SALE">بيع بالأجل — لي عنده</option>
              <option value="PURCHASE">شراء بالأجل — عليّ له</option>
              <option value="PAYMENT_RECEIVED">استلمت دفعة — يقلّ ما له عندي</option>
              <option value="PAYMENT_SENT">أرسلت دفعة — يقلّ ما عليّ له</option>
            </select>
          </div>

          <input type="number" placeholder="المبلغ *" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            required className="w-full rounded border p-2 text-sm" />

          <input type="text" placeholder="الوصف *" value={description} onChange={(e) => setDescription(e.target.value)}
            required minLength={2} maxLength={300} className="w-full rounded border p-2 text-sm" />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">تاريخ القيد</label>
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full rounded border p-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">تاريخ الاستحقاق</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded border p-2 text-sm" />
            </div>
          </div>

          <input type="text" placeholder="رقم مرجعي (اختياري)" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)}
            maxLength={80} className="w-full rounded border p-2 text-sm" />
          <textarea placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} maxLength={1000} className="w-full rounded border p-2 text-sm" />

          {error && <div className="rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">{error}</div>}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">إلغاء</button>
            <button type="submit" disabled={saving}
              className="rounded bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}