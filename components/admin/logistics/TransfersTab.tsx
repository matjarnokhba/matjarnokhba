"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import { TRANSFER_STATUS_LABEL, TRANSFER_STATUS_TONE, OUTCOME_LABEL, DISCREPANCY_LABEL } from "@/lib/logistics-transfer-labels";
import type { WarehouseRow } from "./types";

type TRow = {
  id: number;
  transferNumber: string;
  status: string;
  reason: string;
  requiresApproval: boolean;
  createdAt: string;
  fromWarehouse: { id: number; name: string; code: string };
  toWarehouse: { id: number; name: string; code: string };
  _count: { items: number; discrepancies: number };
};

function ask(msg: string): string | null {
  const v = window.prompt(msg);
  return v && v.trim().length >= 3 ? v.trim() : null;
}

function itemName(fi: any, fallbackId: number): string {
  const p = fi?.orderItem?.product?.name;
  const o = fi?.orderItem?.order?.orderNumber;
  return (p || "عنصر #" + fallbackId) + (o ? " · " + o : "");
}

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [whs, setWhs] = useState<WarehouseRow[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    void (async () => {
      const r = await api("/api/admin/logistics/warehouses");
      if (r.ok) setWhs(((r.json.warehouses ?? r.json.rows ?? []) as WarehouseRow[]).filter((w) => w.status === "ACTIVE"));
    })();
  }, []);

  async function pickFrom(v: string) {
    setFrom(v);
    setSel([]);
    setItems([]);
    setErr("");
    if (!v) return;
    const r = await api("/api/logistics/transfers/eligible?warehouseId=" + v);
    if (r.ok) setItems(r.json.items as any[]);
    else setErr(r.message);
  }

  function toggle(id: number) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await api("/api/logistics/transfers", "POST", {
      fromWarehouseId: Number(from),
      toWarehouseId: Number(to),
      reason: reason.trim(),
      fulfillmentItemIds: sel,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    onDone();
  }

  return (
    <Modal title="نقل جديد بين مستودعين" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="من مستودع">
          <select className={inputCls} value={from} onChange={(e) => void pickFrom(e.target.value)} required>
            <option value="">اختر...</option>
            {whs.map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.company.name})</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="إلى مستودع">
          <select className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">اختر...</option>
            {whs.filter((w) => String(w.id) !== from).map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.company.name})</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="سبب النقل">
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} />
        </FieldRow>
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-600">العناصر المؤهلة ({items.length}) — المحدد: {sel.length}</p>
          {from && items.length === 0 && <p className="text-xs text-gray-500">لا توجد عناصر مؤهلة في هذا المستودع.</p>}
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {items.map((it) => (
              <li key={it.id}>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
                  <input type="checkbox" checked={sel.includes(it.id)} onChange={() => toggle(it.id)} />
                  <span className="flex-1">{itemName(it, it.id)}</span>
                  <span className="text-xs text-gray-500">× {it.quantity}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy || sel.length === 0 || !to} className={btnPrimary + " w-full"}>
          {busy ? "جارٍ الإنشاء..." : "إنشاء مسودة النقل"}
        </button>
      </form>
    </Modal>
  );
}

function DetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [t, setT] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [driverId, setDriverId] = useState("");
  const [rec, setRec] = useState<Record<number, { outcome: string; qty: string; note: string }>>({});
  const [recNote, setRecNote] = useState("");

  const load = useCallback(async () => {
    const r = await api("/api/logistics/transfers/" + id);
    if (r.ok) setT(r.json.transfer);
    else setErr(r.message);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!t || t.status !== "PREPARED") return;
    void (async () => {
      const r = await api("/api/logistics/memberships?warehouseId=" + t.fromWarehouseId);
      if (!r.ok) return;
      const list = ((r.json.memberships ?? []) as any[]).filter((m) => m.status === "ACTIVE" && (m.jobRoles || []).includes("TRANSFER_DRIVER"));
      const seen = new Set<number>();
      setDrivers(list.filter((m) => (seen.has(m.userId) ? false : (seen.add(m.userId), true))));
    })();
  }, [t]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setErr("");
    const r = await api("/api/logistics/transfers/" + id, "PATCH", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setT(r.json.transfer);
    onChanged();
  }

  if (!t) {
    return (
      <Modal title="تفاصيل النقل" onClose={onClose}>
        <p className="text-sm text-gray-500">{err || "جارٍ التحميل..."}</p>
      </Modal>
    );
  }

  const active = (t.items as any[]).filter((i) => i.active);
  const recOf = (fid: number) => rec[fid] ?? { outcome: "RECEIVED", qty: "", note: "" };
  const unresolved = (t.discrepancies as any[]).filter((d) => !d.resolvedAt);

  function submitReceive() {
    const items = active.map((i) => {
      const r = recOf(i.fulfillmentItemId);
      return {
        fulfillmentItemId: i.fulfillmentItemId,
        outcome: r.outcome,
        ...(r.outcome === "PARTIAL" ? { receivedQuantity: Number(r.qty) } : {}),
        ...(r.note.trim() ? { note: r.note.trim() } : {}),
      };
    });
    void act({ action: "receive", items, ...(recNote.trim() ? { note: recNote.trim() } : {}) });
  }

  return (
    <Modal title={"نقل " + t.transferNumber} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge text={TRANSFER_STATUS_LABEL[t.status] ?? t.status} tone={TRANSFER_STATUS_TONE[t.status] ?? "gray"} />
          {t.requiresApproval && <Badge text="بين شركتين: يحتاج موافقة" tone="yellow" />}
        </div>
        <p className="text-sm">
          {t.fromWarehouse.name} ← {t.toWarehouse.name}
        </p>
        <p className="text-xs text-gray-600">السبب: {t.reason}</p>

        <ul className="space-y-1">
          {(t.items as any[]).map((i) => (
            <li key={i.id} className={"rounded-lg border p-2 text-sm " + (i.active ? "border-gray-200" : "border-gray-100 opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{itemName(i.fulfillmentItem, i.fulfillmentItemId)}</span>
                <span className="text-xs text-gray-500">× {i.expectedQuantity}</span>
              </div>
              {i.outcome !== "PENDING" && (
                <p className="text-xs text-gray-600">
                  {OUTCOME_LABEL[i.outcome] ?? i.outcome}
                  {i.receivedQuantity != null ? " (" + i.receivedQuantity + ")" : ""}
                  {i.note ? " — " + i.note : ""}
                </p>
              )}
              {t.status === "DRAFT" && i.active && (
                <button type="button" className={btnGhost + " mt-1"} disabled={busy} onClick={() => void act({ action: "remove_items", fulfillmentItemIds: [i.fulfillmentItemId] })}>
                  إزالة
                </button>
              )}
              {t.status === "DISPATCHED" && i.active && (
                <div className="mt-2 space-y-1">
                  <select
                    className={inputCls}
                    value={recOf(i.fulfillmentItemId).outcome}
                    onChange={(e) => setRec((s) => ({ ...s, [i.fulfillmentItemId]: { ...recOf(i.fulfillmentItemId), outcome: e.target.value } }))}
                  >
                    <option value="RECEIVED">مستلم كاملاً</option>
                    <option value="PARTIAL">كمية جزئية</option>
                    <option value="DAMAGED">تالف</option>
                    <option value="MISSING">مفقود</option>
                  </select>
                  {recOf(i.fulfillmentItemId).outcome === "PARTIAL" && (
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      placeholder={"الكمية المستلمة (أقل من " + i.expectedQuantity + ")"}
                      value={recOf(i.fulfillmentItemId).qty}
                      onChange={(e) => setRec((s) => ({ ...s, [i.fulfillmentItemId]: { ...recOf(i.fulfillmentItemId), qty: e.target.value } }))}
                    />
                  )}
                  {recOf(i.fulfillmentItemId).outcome !== "RECEIVED" && (
                    <input
                      className={inputCls}
                      placeholder="سبب الفرق (إلزامي)"
                      value={recOf(i.fulfillmentItemId).note}
                      onChange={(e) => setRec((s) => ({ ...s, [i.fulfillmentItemId]: { ...recOf(i.fulfillmentItemId), note: e.target.value } }))}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {(t.discrepancies as any[]).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-600">الفروقات</p>
            {(t.discrepancies as any[]).map((d) => (
              <div key={d.id} className="rounded-lg border border-yellow-200 bg-yellow-50 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{DISCREPANCY_LABEL[d.type] ?? d.type} · المتوقع {d.expectedQty} / الفعلي {d.actualQty}</span>
                  {d.resolvedAt ? (
                    <Badge text="محسوم" tone="green" />
                  ) : (
                    <button
                      type="button"
                      className={btnGhost}
                      disabled={busy}
                      onClick={() => {
                        const n = ask("ملاحظة الحسم (3 أحرف على الأقل)");
                        if (n) void act({ action: "resolve_discrepancy", discrepancyId: d.id, note: n });
                      }}
                    >
                      حسم
                    </button>
                  )}
                </div>
                {d.note && <p className="text-xs text-gray-600">{d.note}</p>}
                {d.resolutionNote && <p className="text-xs text-green-700">الحسم: {d.resolutionNote}</p>}
              </div>
            ))}
          </div>
        )}

        {t.status === "PREPARED" && (
          <div className="space-y-1">
            <FieldRow label="سائق النقل">
              {drivers.length > 0 ? (
                <select className={inputCls} value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">اختر السائق...</option>
                  {drivers.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user?.name || "—"} {m.user?.phone || ""}</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-red-600">لا يوجد سائق نقل معيّن في المستودع المصدر. عيّنه من تبويب الموظفين بوظيفة (سائق بين المستودعات).</p>
              )}
            </FieldRow>
          </div>
        )}

        {t.status === "DISPATCHED" && (
          <FieldRow label="ملاحظة الاستلام (اختياري)">
            <input className={inputCls} value={recNote} onChange={(e) => setRecNote(e.target.value)} />
          </FieldRow>
        )}

        {err && <p className="text-sm font-bold text-red-600">{err}</p>}

        <div className="flex flex-wrap gap-2">
          {t.status === "DRAFT" && (
            <button type="button" className={btnPrimary} disabled={busy || active.length === 0} onClick={() => void act({ action: "prepare" })}>
              تجهيز
            </button>
          )}
          {t.status === "PENDING_APPROVAL" && (
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void act({ action: "approve" })}>
              موافقة (أدمن)
            </button>
          )}
          {t.status === "PREPARED" && (
            <button type="button" className={btnPrimary} disabled={busy || !driverId} onClick={() => void act({ action: "dispatch", driverUserId: Number(driverId) })}>
              إرسال
            </button>
          )}
          {t.status === "DISPATCHED" && (
            <button type="button" className={btnPrimary} disabled={busy} onClick={submitReceive}>
              تأكيد الاستلام
            </button>
          )}
          {(t.status === "RECEIVED" || t.status === "RECEIVED_WITH_DISCREPANCY") && (
            <button type="button" className={btnPrimary} disabled={busy || unresolved.length > 0} onClick={() => void act({ action: "close" })}>
              {unresolved.length > 0 ? "إغلاق (احسم الفروقات أولاً)" : "إغلاق"}
            </button>
          )}
          {["DRAFT", "PENDING_APPROVAL", "PREPARED"].includes(t.status) && (
            <button
              type="button"
              className={btnGhost}
              disabled={busy}
              onClick={() => {
                const n = ask("سبب الإلغاء (3 أحرف على الأقل)");
                if (n) void act({ action: "cancel", reason: n });
              }}
            >
              إلغاء النقل
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function TransfersTab() {
  const [rows, setRows] = useState<TRow[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/logistics/transfers" + (status ? "?status=" + status : ""));
    if (r.ok) {
      setRows(r.json.transfers as TRow[]);
      setErr("");
    } else setErr(r.message);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">التحويلات ({rows.length})</h2>
        <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> نقل
        </button>
      </div>
      <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">كل الحالات</option>
        {Object.entries(TRANSFER_STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-500">لا توجد تحويلات.</p>}
      {rows.map((t) => (
        <button key={t.id} type="button" onClick={() => setOpenId(t.id)} className="block w-full space-y-1 rounded-xl border border-gray-200 bg-white p-3 text-right">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold" dir="ltr">{t.transferNumber}</span>
            <Badge text={TRANSFER_STATUS_LABEL[t.status] ?? t.status} tone={TRANSFER_STATUS_TONE[t.status] ?? "gray"} />
          </div>
          <p className="text-sm">{t.fromWarehouse.name} ← {t.toWarehouse.name}</p>
          <p className="text-xs text-gray-500">
            {t._count.items} عنصر{t._count.discrepancies > 0 ? " · " + t._count.discrepancies + " فرق" : ""} · {t.reason}
          </p>
        </button>
      ))}
      {showNew && (
        <CreateModal
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}
      {openId !== null && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}
    </div>
  );
}