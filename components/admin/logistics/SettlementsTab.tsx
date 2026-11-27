"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { api, inputCls, btnPrimary, btnGhost } from "./ui";

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB") : "—");
const n2 = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

export default function SettlementsTab() {
  const [providers, setProviders] = useState<any[]>([]);
  const [pid, setPid] = useState("");
  const [open, setOpen] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [sel, setSel] = useState<Record<number, string>>({});
  const [reference, setReference] = useState("");
  const [received, setReceived] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api("/api/admin/logistics/providers").then((r) => {
      if (r.ok) setProviders(r.json.providers ?? []);
    });
  }, []);

  const load = useCallback(async () => {
    if (!pid) {
      setOpen([]);
      setHistory([]);
      return;
    }
    const r = await api("/api/admin/logistics/external-settlements?providerId=" + pid);
    if (!r.ok) return setErr(r.message);
    setErr("");
    setOpen(r.json.open ?? []);
    setHistory(r.json.settlements ?? []);
    setSel({});
  }, [pid]);

  useEffect(() => {
    load();
  }, [load]);

  const chosen = open.filter((r) => sel[r.id] !== undefined);
  const due = chosen.reduce((s, r) => s + r.amountDue, 0);
  const fees = chosen.reduce((s, r) => s + (Number(sel[r.id]) || 0), 0);
  const expected = due - fees;
  const rec = Number(received) || 0;
  const shortfall = expected - rec;

  async function submit() {
    setErr("");
    setMsg("");
    if (chosen.length === 0) return setErr("اختر ديناً واحداً على الأقل");
    if (received.trim() === "" || Number.isNaN(Number(received))) return setErr("أدخل صافي المبلغ المستلم");
    if (!window.confirm("تأكيد التسوية؟ لا يمكن التراجع عنها.")) return;
    setBusy(true);
    const body: Record<string, unknown> = {
      providerId: Number(pid),
      received: rec,
      lines: chosen.map((r) => ({ receivableId: r.id, courierFee: Number(sel[r.id]) || 0 })),
    };
    if (reference.trim()) body.reference = reference.trim();
    if (notes.trim()) body.notes = notes.trim();
    const r = await api("/api/admin/logistics/external-settlements", "POST", body);
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    const s = r.json.settlement;
    setMsg("تمت التسوية #" + s.id + " — ربح المستودع " + n2(s.warehouseProfit) + " د.م" + (s.shortfall !== 0 ? " — فرق عن المستحق " + n2(s.shortfall) : ""));
    setReference("");
    setReceived("");
    setNotes("");
    await load();
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">تسوية شركات التوصيل الخارجية</h2>
      <p className="rounded-lg bg-yellow-50 p-2 text-xs font-bold text-yellow-800">
        لا تحرّر أرباح البائعين من «تحرير الأرباح المحجوزة» قبل أن تستلم هذه المبالغ من الشركة.
      </p>
      <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)}>
        <option value="">اختر الشركة</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}

      {pid && (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold">ديون مفتوحة ({open.length})</div>
            {open.length > 0 && (
              <button
                type="button"
                className={btnGhost}
                onClick={() => setSel(chosen.length === open.length ? {} : Object.fromEntries(open.map((r) => [r.id, sel[r.id] ?? ""])))}
              >
                {chosen.length === open.length ? "إلغاء التحديد" : "تحديد الكل"}
              </button>
            )}
          </div>
          {open.length === 0 && <p className="text-sm text-gray-500">لا توجد ديون مفتوحة لهذه الشركة.</p>}
          <div className="space-y-1">
            {open.map((r) => (
              <div key={r.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs">
                <input
                  type="checkbox"
                  checked={sel[r.id] !== undefined}
                  onChange={(e) => {
                    const next = { ...sel };
                    if (e.target.checked) next[r.id] = "";
                    else delete next[r.id];
                    setSel(next);
                  }}
                />
                <div>
                  <div className="font-bold" dir="ltr">{r.shipmentNumber}</div>
                  <div className="text-gray-600">المستحق {n2(r.amountDue)} — رسم الشحن {n2(r.shippingCharged)}</div>
                </div>
                <input
                  className={inputCls + " w-24"}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="رسم الشركة"
                  disabled={sel[r.id] === undefined}
                  value={sel[r.id] ?? ""}
                  onChange={(e) => setSel({ ...sel, [r.id]: e.target.value.replace(/[^0-9.]/g, "") })}
                />
              </div>
            ))}
          </div>

          {chosen.length > 0 && (
            <div className="space-y-2 rounded-lg border border-gray-200 p-2">
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>مجموع المستحق: <b>{n2(due)}</b></div>
                <div>رسوم الشركة: <b>{n2(fees)}</b></div>
                <div>الصافي المتوقع: <b>{n2(expected)}</b></div>
                <div className={shortfall !== 0 && received.trim() !== "" ? "text-red-700" : ""}>الفرق: <b>{received.trim() === "" ? "—" : n2(shortfall)}</b></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} dir="ltr" placeholder="مرجع كشف الشركة (اختياري)" value={reference} onChange={(e) => setReference(e.target.value)} />
                <div className="flex gap-1">
                  <input className={inputCls} dir="ltr" inputMode="decimal" placeholder="المبلغ المستلم فعلياً" value={received} onChange={(e) => setReceived(e.target.value.replace(/[^0-9.]/g, ""))} />
                  <button type="button" className={btnGhost} onClick={() => setReceived(n2(expected))}>= الصافي</button>
                </div>
              </div>
              <input className={inputCls} placeholder="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button type="button" disabled={busy} className={btnPrimary + " w-full"} onClick={submit}>
                {busy ? "..." : "تأكيد التسوية"}
              </button>
            </div>
          )}
        </div>
      )}

      {pid && (
        <div className="space-y-1 rounded-xl border border-gray-200 p-3">
          <div className="text-sm font-bold">سجل التسويات ({history.length})</div>
          {history.length === 0 && <p className="text-xs text-gray-400">لا توجد تسويات.</p>}
          <div className="max-h-72 divide-y overflow-y-auto text-xs">
            {history.map((h) => (
              <div key={h.id} className="space-y-0.5 py-2">
                <div className="flex items-center justify-between">
                  <b>تسوية #{h.id}{h.reference ? " — " + h.reference : ""}</b>
                  <span className="text-gray-500">{fmt(h.createdAt)}</span>
                </div>
                <div className="text-gray-600">
                  {h.linesCount} شحنة | مستحق {n2(h.totalDue)} | رسوم {n2(h.totalFees)} | مستلم {n2(h.received)}
                  {h.shortfall !== 0 && <span className="text-red-700"> | فرق {n2(h.shortfall)}</span>}
                  {h.feeOverShipping > 0 && <span className="text-yellow-700"> | رسوم فوق رسم الشحن {n2(h.feeOverShipping)}</span>}
                </div>
                {h.notes && <div className="text-gray-500">{h.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}