"use client";
import { useCallback, useEffect, useState } from "react";
import { api, inputCls } from "./ui";

type Row = {
  id: number;
  entityType: string;
  entityId: number;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  fromWarehouseName: string | null;
  toWarehouseName: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: string;
};

const ENTITY_LABEL: Record<string, string> = {
  FULFILLMENT_ITEM: "عنصر تجهيز",
  SHIPMENT: "شحنة",
  TRANSFER: "نقل",
};

export default function MovementsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [et, setEt] = useState("");
  const [eid, setEid] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (et) qs.set("entityType", et);
    if (eid.trim()) qs.set("entityId", eid.trim());
    const r = await api("/api/admin/logistics/movements?" + qs.toString());
    if (r.ok) setRows(r.json.movements as Row[]);
    else setErr(r.message);
    setLoading(false);
  }, [et, eid]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">حركة الطرود</h2>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={et} onChange={(e) => setEt(e.target.value)}>
          <option value="">كل الأنواع</option>
          <option value="FULFILLMENT_ITEM">عناصر التجهيز</option>
          <option value="SHIPMENT">الشحنات</option>
          <option value="TRANSFER">النقل</option>
        </select>
        <input className={inputCls} dir="ltr" placeholder="رقم العنصر/الشحنة" value={eid} onChange={(e) => setEid(e.target.value)} />
      </div>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-500">لا توجد حركات.</p>}
      {rows.map((m) => (
        <div key={m.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">{ENTITY_LABEL[m.entityType] ?? m.entityType} #{m.entityId}</span>
            <span className="text-xs text-gray-500">{new Date(m.createdAt).toLocaleString("ar-MA")}</span>
          </div>
          <p className="text-xs text-gray-600" dir="ltr">
            {m.fromStatus ? m.fromStatus + " → " : ""}{m.toStatus ?? m.action}
          </p>
          <p className="text-xs text-gray-500">
            {m.toWarehouseName || m.fromWarehouseName ? "المستودع: " + (m.toWarehouseName || m.fromWarehouseName) + " · " : ""}
            {m.actorName ? "بواسطة " + m.actorName : ""}
            {m.reason ? " · " + m.reason : ""}
          </p>
        </div>
      ))}
    </div>
  );
}