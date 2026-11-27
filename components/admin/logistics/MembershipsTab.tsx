"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import { MEMBERSHIP_STATUS_LABEL, SCOPE_LABEL, statusTone } from "@/lib/logistics-labels";
import { JOB_ROLES, JOB_ROLE_LABEL } from "@/lib/logistics-validation";
import UserPicker from "./UserPicker";
import type { CompanyRow, MembershipRow, UserHit, WarehouseRow } from "./types";

function RolesPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {JOB_ROLES.map((r) => (
        <label key={r} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(r)}
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
          />
          {JOB_ROLE_LABEL[r]}
        </label>
      ))}
    </div>
  );
}

function Appoint({
  warehouses,
  companies,
  defaultWarehouseId,
  onClose,
  onDone,
}: {
  warehouses: WarehouseRow[];
  companies: CompanyRow[];
  defaultWarehouseId: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [user, setUser] = useState<UserHit | null>(null);
  const [scope, setScope] = useState("WAREHOUSE");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId ? String(defaultWarehouseId) : warehouses[0] ? String(warehouses[0].id) : "");
  const [companyId, setCompanyId] = useState(companies[0] ? String(companies[0].id) : "");
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setErr("اختر المستخدم");
      return;
    }
    setBusy(true);
    setErr("");
    const body: Record<string, unknown> = { userId: user.id, scope, jobRoles: roles };
    if (scope === "WAREHOUSE") body.warehouseId = Number(warehouseId);
    if (scope === "COMPANY") body.companyId = Number(companyId);
    const r = await api("/api/logistics/memberships", "POST", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    onDone();
  }

  return (
    <Modal title="تعيين عضو" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="المستخدم">
          <UserPicker value={user} onChange={setUser} />
        </FieldRow>
        <FieldRow label="النطاق">
          <select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="WAREHOUSE">مستودع</option>
            <option value="COMPANY">شركة</option>
            <option value="PLATFORM">المنصة (صلاحية كاملة)</option>
          </select>
        </FieldRow>
        {scope === "WAREHOUSE" && (
          <FieldRow label="المستودع">
            <select className={inputCls} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
              ))}
            </select>
          </FieldRow>
        )}
        {scope === "COMPANY" && (
          <FieldRow label="الشركة">
            <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FieldRow>
        )}
        {scope !== "PLATFORM" && (
          <FieldRow label="الوظائف">
            <RolesPicker value={roles} onChange={setRoles} />
          </FieldRow>
        )}
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary + " w-full"}>
          {busy ? "جارٍ الحفظ..." : "تعيين"}
        </button>
      </form>
    </Modal>
  );
}

function EditRoles({ m, onClose, onDone }: { m: MembershipRow; onClose: () => void; onDone: () => void }) {
  const [roles, setRoles] = useState<string[]>(m.jobRoles);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    setBusy(true);
    const r = await api("/api/logistics/memberships/" + m.id, "PATCH", { jobRoles: roles });
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    onDone();
  }
  return (
    <Modal title={"وظائف: " + (m.user.name || "—")} onClose={onClose}>
      <div className="space-y-3">
        <RolesPicker value={roles} onChange={setRoles} />
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="button" disabled={busy} className={btnPrimary + " w-full"} onClick={() => void save()}>
          حفظ
        </button>
      </div>
    </Modal>
  );
}

export default function MembershipsTab({ initialWarehouseId }: { initialWarehouseId: number | null }) {
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [wf, setWf] = useState(initialWarehouseId ? String(initialWarehouseId) : "");
  const [sf, setSf] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<MembershipRow | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (wf) qs.set("warehouseId", wf);
    if (sf) qs.set("status", sf);
    const [m, w, c] = await Promise.all([
      api("/api/logistics/memberships?" + qs.toString()),
      api("/api/admin/logistics/warehouses"),
      api("/api/admin/logistics/companies"),
    ]);
    if (m.ok) setRows(m.json.memberships as MembershipRow[]);
    else setErr(m.message);
    if (w.ok) setWarehouses(w.json.warehouses as WarehouseRow[]);
    if (c.ok) setCompanies(c.json.companies as CompanyRow[]);
    setLoading(false);
  }, [wf, sf]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: number, status: string) {
    if (status === "REVOKED" && !confirm("سحب هذه العضوية؟ يبقى السجل محفوظاً.")) return;
    const r = await api("/api/logistics/memberships/" + id, "PATCH", { status });
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
        <h2 className="text-lg font-bold">الموظفون والعضويات ({rows.length})</h2>
        <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> تعيين
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select className={inputCls} value={wf} onChange={(e) => setWf(e.target.value)}>
          <option value="">كل المستودعات</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <select className={inputCls} value={sf} onChange={(e) => setSf(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="ACTIVE">نشطة</option>
          <option value="SUSPENDED">موقوفة</option>
          <option value="REVOKED">مسحوبة</option>
        </select>
      </div>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {rows.map((m) => (
        <div key={m.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold">{m.user.name || "—"}</p>
              <p className="text-xs text-gray-500" dir="ltr">{m.user.phone || ""} · {m.user.role}</p>
            </div>
            <Badge text={MEMBERSHIP_STATUS_LABEL[m.status] ?? m.status} tone={statusTone(m.status)} />
          </div>
          <p className="text-xs text-gray-600">
            {SCOPE_LABEL[m.scope] ?? m.scope}
            {m.warehouse ? ": " + m.warehouse.name : ""}
            {m.scope === "COMPANY" && m.company ? ": " + m.company.name : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {m.jobRoles.length === 0 && <span className="text-xs text-gray-400">بلا وظائف</span>}
            {m.jobRoles.map((r) => (
              <Badge key={r} text={JOB_ROLE_LABEL[r as keyof typeof JOB_ROLE_LABEL] ?? r} tone={r === "MANAGER" ? "blue" : "gray"} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {m.status !== "REVOKED" && m.scope !== "PLATFORM" && (
              <button type="button" className={btnGhost} onClick={() => setEditing(m)}>تعديل الوظائف</button>
            )}
            {m.status === "ACTIVE" && <button type="button" className={btnGhost} onClick={() => void setStatus(m.id, "SUSPENDED")}>إيقاف</button>}
            {m.status !== "ACTIVE" && <button type="button" className={btnGhost} onClick={() => void setStatus(m.id, "ACTIVE")}>{m.status === "REVOKED" ? "إعادة تفعيل" : "تفعيل"}</button>}
            {m.status !== "REVOKED" && <button type="button" className={btnGhost} onClick={() => void setStatus(m.id, "REVOKED")}>سحب</button>}
          </div>
        </div>
      ))}
      {showNew && (
        <Appoint
          warehouses={warehouses}
          companies={companies}
          defaultWarehouseId={wf ? Number(wf) : null}
          onClose={() => setShowNew(false)}
          onDone={() => {
            setShowNew(false);
            void load();
          }}
        />
      )}
      {editing && (
        <EditRoles
          m={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}