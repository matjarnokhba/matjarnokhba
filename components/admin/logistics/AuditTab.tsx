"use client";
import { useCallback, useEffect, useState } from "react";
import { api, inputCls } from "./ui";
import { AUDIT_ACTION_LABEL } from "@/lib/logistics-labels";
import type { AuditRow } from "./types";

const ENTITY_LABEL: Record<string, string> = {
  Warehouse: "مستودع",
  LogisticsCompany: "شركة",
  LogisticsMembership: "عضوية",
  WarehouseTransfer: "نقل",
  ClientPlatform: "منصة عميلة",
  CompanyPlatformLink: "ربط منصة",
  DeliveryPerson: "سائق",
  ShippingProvider: "مزوّد توصيل خارجي",
};

export default function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [et, setEt] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await api("/api/admin/logistics/audit" + (et ? "?entityType=" + et : ""));
    if (r.ok) setRows(r.json.logs as AuditRow[]);
    else setErr(r.message);
    setLoading(false);
  }, [et]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">سجل التدقيق</h2>
        <select className={inputCls + " max-w-[10rem]"} value={et} onChange={(e) => setEt(e.target.value)}>
          <option value="">الكل</option>
          <option value="Warehouse">المستودعات</option>
          <option value="LogisticsCompany">الشركات</option>
          <option value="LogisticsMembership">العضويات</option>
          <option value="WarehouseTransfer">النقل</option>
          <option value="ClientPlatform">المنصات العميلة</option>
          <option value="CompanyPlatformLink">ربط المنصات</option>
          <option value="DeliveryPerson">السائقون</option>
          <option value="ShippingProvider">مزوّدو التوصيل</option>
        </select>
      </div>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-500">لا توجد سجلات.</p>}
      {rows.map((l) => (
        <div key={l.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
          <button type="button" className="w-full text-right" onClick={() => setOpen(open === l.id ? null : l.id)}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{AUDIT_ACTION_LABEL[l.action] ?? l.action}</span>
              <span className="text-xs text-gray-500">{new Date(l.createdAt).toLocaleString("ar-MA")}</span>
            </div>
            <p className="text-xs text-gray-600">
              {ENTITY_LABEL[l.entityType] ?? l.entityType} #{l.entityId} · بواسطة {l.actorName || (l.userId ? "#" + l.userId : "النظام")}
            </p>
          </button>
          {open === l.id && (
            <div className="mt-2 grid gap-2">
              {l.before != null && (
                <pre dir="ltr" className="overflow-x-auto rounded bg-gray-50 p-2 text-[11px]">قبل: {JSON.stringify(l.before, null, 2)}</pre>
              )}
              {l.after != null && (
                <pre dir="ltr" className="overflow-x-auto rounded bg-gray-50 p-2 text-[11px]">بعد: {JSON.stringify(l.after, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}