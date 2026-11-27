"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import { WAREHOUSE_STATUS_LABEL, KIND_LABEL, statusTone } from "@/lib/logistics-labels";
import { WAREHOUSE_TRANSITIONS } from "@/lib/logistics-rules";
import type { CompanyRow, WarehouseRow } from "./types";

function NewWarehouse({ companies, onClose, onDone }: { companies: CompanyRow[]; onClose: () => void; onDone: () => void }) {
  const usable = companies.filter((c) => c.status !== "DETACHING" && c.status !== "DETACHED");
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(usable[0] ? String(usable[0].id) : "");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [capacity, setCapacity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body: Record<string, unknown> = { name: name.trim(), companyId: Number(companyId), city: city.trim() };
    if (district.trim()) body.district = district.trim();
    if (address.trim()) body.address = address.trim();
    if (lat.trim() || lng.trim()) {
      body.latitude = Number(lat);
      body.longitude = Number(lng);
    }
    if (capacity.trim()) body.capacity = Number(capacity);
    const r = await api("/api/admin/logistics/warehouses", "POST", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    onDone();
  }

  return (
    <Modal title="مستودع جديد" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="اسم المستودع">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </FieldRow>
        <FieldRow label="الشركة">
          <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
            {usable.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({KIND_LABEL[c.kind] ?? c.kind})</option>
            ))}
          </select>
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="المدينة">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
          </FieldRow>
          <FieldRow label="الحي (اختياري)">
            <input className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} />
          </FieldRow>
        </div>
        <FieldRow label="العنوان الدقيق (اختياري)">
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </FieldRow>
        <div className="grid grid-cols-3 gap-2">
          <FieldRow label="خط العرض">
            <input className={inputCls} dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)} />
          </FieldRow>
          <FieldRow label="خط الطول">
            <input className={inputCls} dir="ltr" value={lng} onChange={(e) => setLng(e.target.value)} />
          </FieldRow>
          <FieldRow label="السعة">
            <input className={inputCls} dir="ltr" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </FieldRow>
        </div>
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary + " w-full"}>
          {busy ? "جارٍ الحفظ..." : "إنشاء"}
        </button>
      </form>
    </Modal>
  );
}

export default function WarehousesTab({ onShowStaff }: { onShowStaff: (warehouseId: number) => void }) {
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const [w, c] = await Promise.all([
      api("/api/admin/logistics/warehouses"),
      api("/api/admin/logistics/companies"),
    ]);
    if (w.ok) setRows(w.json.warehouses as WarehouseRow[]);
    else setErr(w.message);
    if (c.ok) setCompanies(c.json.companies as CompanyRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: number, status: string) {
    if (status === "CLOSED" && !confirm("إغلاق المستودع؟ يمكن إعادة تفعيله لاحقاً.")) return;
    const r = await api("/api/admin/logistics/warehouses/" + id, "PATCH", { status });
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setErr("");
    await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">المستودعات ({rows.length})</h2>
        <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> مستودع
        </button>
      </div>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {rows.map((w) => (
        <div key={w.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">
                {w.name} {w.isDefault && <span className="text-xs text-[#ff5c00]">(الافتراضي)</span>}
              </p>
              <p className="text-xs text-gray-500" dir="ltr">{w.code}</p>
            </div>
            <Badge text={WAREHOUSE_STATUS_LABEL[w.status] ?? w.status} tone={statusTone(w.status)} />
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <span>المدينة: {w.city}{w.district ? " - " + w.district : ""}</span>
            <span>الشركة: {w.company.name}</span>
            <span>المدير: {w.manager ? (w.manager.name || "—") : "غير معيّن"}</span>
            <span>الموظفون النشطون: {w._count.memberships}</span>
            {w.capacity != null && <span>السعة: {w.capacity}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => onShowStaff(w.id)}>الموظفون</button>
            {!w.isDefault &&
              (WAREHOUSE_TRANSITIONS[w.status] ?? []).map((to) => (
                <button key={to} type="button" className={btnGhost} onClick={() => void setStatus(w.id, to)}>
                  {to === "ACTIVE" ? "تفعيل" : to === "SUSPENDED" ? "إيقاف" : "إغلاق"}
                </button>
              ))}
          </div>
        </div>
      ))}
      {showNew && (
        <NewWarehouse
          companies={companies}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}
    </div>
  );
}