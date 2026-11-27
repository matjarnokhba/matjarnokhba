"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import { CANONICAL_UI_LABEL, canonicalTone, SUBMIT_STATE_LABEL, submitTone, IGNORED_REASON_LABEL, OPERATION_LABEL } from "@/lib/integration-labels";

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB") : "—");

function outcomeText(ev: any): string {
  if (!ev) return "تم";
  if (ev.outcome === "APPLIED") return "طُبّقت الحالة";
  if (ev.outcome === "DUPLICATE") return "حدث مكرر — لم يُسجَّل";
  if (ev.outcome === "UNMAPPED") return "حالة غير مربوطة — حُفظت دون تغيير الحالة";
  if (ev.outcome === "IGNORED") return "حُفظ دون تطبيق (" + (IGNORED_REASON_LABEL[ev.reason] ?? ev.reason ?? "") + ")";
  return ev.outcome;
}

function DetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [trk, setTrk] = useState("");
  const [extId, setExtId] = useState("");
  const [raw, setRaw] = useState("");
  const [can, setCan] = useState("");

  const load = useCallback(async () => {
    const r = await api("/api/logistics/external-shipments/" + id);
    if (!r.ok) return setErr(r.message);
    setData(r.json);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setErr("");
    setMsg("");
    const r = await api("/api/logistics/external-shipments/" + id, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    setMsg(r.json.event ? outcomeText(r.json.event) : okMsg);
    await load();
    onChanged();
  }

  if (!data) {
    return (
      <Modal title="شحنة خارجية" onClose={onClose}>
        <p className="text-sm text-gray-500">{err || "جارٍ التحميل..."}</p>
      </Modal>
    );
  }
  const e = data.external;
  const pl = e.payload ?? {};
  const events: any[] = data.events ?? [];
  const logs: any[] = data.logs ?? [];
  const canRetry = e.submitState === "FAILED" || e.submitState === "NOT_SUBMITTED" || e.submitState === "SUBMITTING";
  const canTrack = e.submitState === "SUBMITTED" || e.submitState === "MANUAL";

  return (
    <Modal title={"شحنة #" + e.shipmentId + " — " + (e.provider?.name ?? "")} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge text={CANONICAL_UI_LABEL[e.status] ?? e.status} tone={canonicalTone(e.status)} />
          <Badge text={SUBMIT_STATE_LABEL[e.submitState] ?? e.submitState} tone={submitTone(e.submitState)} />
        </div>
        {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <div className="space-y-1 rounded-xl border border-gray-200 p-3 text-xs">
          <div>رقم الطلب الأصلي: <b dir="ltr">{(pl.orderNumbers ?? []).join(", ") || "—"}</b></div>
          <div>المرجع المُرسل: <b dir="ltr">{pl.reference ?? "—"}</b></div>
          <div>المعرّف الخارجي: <b dir="ltr">{e.externalId ?? "—"}</b></div>
          <div>رقم التتبع: <b dir="ltr">{e.trackingNumber ?? "—"}</b></div>
          <div>الحالة الأصلية لدى الشركة: <b dir="auto">{e.rawStatus ?? "—"}</b></div>
          <div>المستلم: {pl.recipient ? pl.recipient.name + " — " + pl.recipient.city : "—"} | الدفع عند الاستلام: {pl.cod ?? 0} درهم</div>
          <div>المحاولات: {e.attempts} | المحاولة التالية: {fmt(e.nextRetryAt)}</div>
          {e.lastError && <div className="text-red-700">آخر خطأ: {e.lastError}</div>}
          <div className="text-gray-500" dir="ltr">{e.idempotencyKey}</div>
        </div>

        {canRetry && (
          <button type="button" disabled={busy} className={btnPrimary + " w-full"} onClick={() => act({ action: "retry" }, "أُعيدت المحاولة")}>
            إعادة محاولة الإرسال
          </button>
        )}

        {canTrack && (
          <div className="space-y-2 rounded-xl border border-gray-200 p-3">
            <div className="text-sm font-bold">إدخال التتبع يدوياً</div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} dir="ltr" placeholder="رقم التتبع" value={trk} onChange={(x) => setTrk(x.target.value)} />
              <input className={inputCls} dir="ltr" placeholder="المعرّف الخارجي" value={extId} onChange={(x) => setExtId(x.target.value)} />
            </div>
            <button
              type="button"
              disabled={busy || (!trk.trim() && !extId.trim())}
              className={btnGhost}
              onClick={async () => {
                const body: Record<string, unknown> = { action: "set_tracking" };
                if (trk.trim()) body.trackingNumber = trk.trim();
                if (extId.trim()) body.externalId = extId.trim();
                await act(body, "تم حفظ التتبع");
                setTrk("");
                setExtId("");
              }}
            >
              حفظ التتبع
            </button>
            <div className="text-sm font-bold">إدخال حالة يدوياً</div>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} placeholder="حالة الشركة (نص)" value={raw} onChange={(x) => setRaw(x.target.value)} />
              <select className={inputCls} value={can} onChange={(x) => setCan(x.target.value)}>
                <option value="">حسب جدول الربط</option>
                {Object.entries(CANONICAL_UI_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={busy || !raw.trim()}
              className={btnGhost}
              onClick={async () => {
                const body: Record<string, unknown> = { action: "add_event", rawStatus: raw.trim() };
                if (can) body.canonicalStatus = can;
                await act(body, "تم");
                setRaw("");
              }}
            >
              تسجيل الحالة
            </button>
          </div>
        )}

        <div className="space-y-1 rounded-xl border border-gray-200 p-3">
          <div className="text-sm font-bold">الأحداث ({events.length})</div>
          <div className="max-h-52 divide-y overflow-y-auto text-xs">
            {events.map((ev) => (
              <div key={ev.id} className="space-y-0.5 py-1">
                <div className="flex items-center justify-between">
                  <b dir="auto">{ev.rawStatus}</b>
                  <span className={ev.applied ? "text-green-700" : "text-gray-500"}>
                    {ev.applied ? "طُبّق" : "حُفظ فقط: " + (IGNORED_REASON_LABEL[ev.ignoredReason] ?? ev.ignoredReason ?? "")}
                  </span>
                </div>
                <div className="text-gray-500">
                  {ev.canonicalStatus ? CANONICAL_UI_LABEL[ev.canonicalStatus] + " — " : ""}
                  {fmt(ev.occurredAt)} — {ev.source}
                </div>
              </div>
            ))}
            {events.length === 0 && <div className="py-2 text-gray-400">لا توجد أحداث</div>}
          </div>
        </div>

        <div className="space-y-1 rounded-xl border border-gray-200 p-3">
          <div className="text-sm font-bold">سجل الإرسال والاستقبال ({logs.length})</div>
          <div className="max-h-44 divide-y overflow-y-auto text-xs">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-1">
                <span>{OPERATION_LABEL[l.operation] ?? l.operation}{l.httpStatus ? " (" + l.httpStatus + ")" : ""}</span>
                <span className={l.ok ? "text-green-700" : "text-red-700"}>{l.ok ? "نجح" : l.error ?? "فشل"} — {fmt(l.createdAt)}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="py-2 text-gray-400">لا يوجد سجل</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function ExternalShipmentsTab() {
  const [list, setList] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [fProvider, setFProvider] = useState("");
  const [fSubmit, setFSubmit] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [shipId, setShipId] = useState("");
  const [provId, setProvId] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (fProvider) qs.set("providerId", fProvider);
    if (fSubmit) qs.set("submitState", fSubmit);
    if (fStatus) qs.set("status", fStatus);
    const [a, b] = await Promise.all([api("/api/logistics/external-shipments?" + qs.toString()), api("/api/admin/logistics/providers")]);
    setLoading(false);
    if (!a.ok) return setErr(a.message);
    setErr("");
    setList(a.json.externalShipments ?? []);
    if (b.ok) setProviders(b.json.providers ?? []);
  }, [fProvider, fSubmit, fStatus]);

  useEffect(() => {
    load();
  }, [load]);

  async function dispatch(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setErr("");
    setMsg("");
    const r = await api("/api/logistics/external-shipments", "POST", { shipmentId: Number(shipId), providerId: Number(provId) });
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    const e = r.json.external;
    setMsg(r.json.duplicate ? "الشحنة مرسلة سابقاً (لم تُنشأ نسخة جديدة)" : e.submitState === "FAILED" ? "تعذّر الإرسال: " + (e.lastError ?? "") : "تم الإرسال");
    setShipId("");
    load();
  }

  const active = providers.filter((p) => p.status === "ACTIVE");

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold">الشحنات الخارجية</h2>
      <form onSubmit={dispatch} className="space-y-2 rounded-xl border border-gray-200 p-3">
        <div className="text-sm font-bold">إرسال شحنة لشركة توصيل</div>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="رقم الشحنة (ID)">
            <input className={inputCls} dir="ltr" inputMode="numeric" value={shipId} onChange={(e) => setShipId(e.target.value.replace(/\D/g, ""))} required />
          </FieldRow>
          <FieldRow label="الشركة (النشطة فقط)">
            <select className={inputCls} value={provId} onChange={(e) => setProvId(e.target.value)} required>
              <option value="">اختر</option>
              {active.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </FieldRow>
        </div>
        <button type="submit" disabled={busy || !shipId || !provId} className={btnPrimary + " w-full"}>{busy ? "..." : "إرسال"}</button>
        <p className="text-xs text-gray-500">الشحنة يجب أن تكون جاهزة وبلا سائق داخلي. إعادة الإرسال لا تُنشئ نسخة ثانية.</p>
      </form>
      {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}

      <div className="grid grid-cols-3 gap-2">
        <select className={inputCls} value={fProvider} onChange={(e) => setFProvider(e.target.value)}>
          <option value="">كل الشركات</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select className={inputCls} value={fSubmit} onChange={(e) => setFSubmit(e.target.value)}>
          <option value="">كل حالات الإرسال</option>
          {Object.entries(SUBMIT_STATE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select className={inputCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(CANONICAL_UI_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {!loading && list.length === 0 && !err && <p className="text-sm text-gray-500">لا توجد شحنات خارجية.</p>}
      <div className="space-y-2">
        {list.map((e) => (
          <button key={e.id} type="button" onClick={() => setOpenId(e.id)} className="w-full space-y-1 rounded-xl border border-gray-200 p-3 text-right hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="font-bold">شحنة #{e.shipmentId}</span>
              <span className="text-xs text-gray-500">{e.provider?.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge text={CANONICAL_UI_LABEL[e.status] ?? e.status} tone={canonicalTone(e.status)} />
              <Badge text={SUBMIT_STATE_LABEL[e.submitState] ?? e.submitState} tone={submitTone(e.submitState)} />
              {e.trackingNumber && <span dir="ltr">{e.trackingNumber}</span>}
              {e.attempts > 1 && <span className="text-gray-500">محاولات: {e.attempts}</span>}
            </div>
            {e.lastError && <div className="text-xs text-red-700">{e.lastError}</div>}
          </button>
        ))}
      </div>
      {openId !== null && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}