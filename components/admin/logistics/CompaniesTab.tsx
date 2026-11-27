"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import { COMPANY_STATUS_LABEL, KIND_LABEL, statusTone } from "@/lib/logistics-labels";
import { COMPANY_TRANSITIONS } from "@/lib/logistics-rules";
import UserPicker from "./UserPicker";
import type { CompanyRow, UserHit } from "./types";

function CompanyForm({
  title,
  initialName,
  showKind,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName?: string;
  showKind: boolean;
  onClose: () => void;
  onSubmit: (v: { name: string; kind: string; headUserId: number | null }) => Promise<string>;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [kind, setKind] = useState("INTERNAL");
  const [head, setHead] = useState<UserHit | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const m = await onSubmit({ name: name.trim(), kind, headUserId: head ? head.id : null });
    setBusy(false);
    if (m) setErr(m);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="اسم الشركة">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </FieldRow>
        {showKind && (
          <FieldRow label="النوع">
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="INTERNAL">داخلية</option>
              <option value="EXTERNAL">خارجية</option>
            </select>
          </FieldRow>
        )}
        <FieldRow label="رئيس الشركة (اختياري)">
          <UserPicker value={head} onChange={setHead} />
        </FieldRow>
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary + " w-full"}>
          {busy ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </form>
    </Modal>
  );
}

export default function CompaniesTab() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [headFor, setHeadFor] = useState<CompanyRow | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/admin/logistics/companies");
    if (r.ok) setRows(r.json.companies as CompanyRow[]);
    else setErr(r.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(id: number, status: string) {
    if (status === "DETACHING" && !confirm("بدء فصل الشركة؟ لن تستقبل طلبات جديدة.")) return;
    const r = await api("/api/admin/logistics/companies/" + id, "PATCH", { status });
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
        <h2 className="text-lg font-bold">شركات التوصيل ({rows.length})</h2>
        <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> شركة
        </button>
      </div>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {rows.map((c) => (
        <div key={c.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold">{c.name}</p>
              <p className="text-xs text-gray-500" dir="ltr">{c.code}</p>
            </div>
            <div className="flex gap-1">
              <Badge text={KIND_LABEL[c.kind] ?? c.kind} tone="blue" />
              <Badge text={COMPANY_STATUS_LABEL[c.status] ?? c.status} tone={statusTone(c.status)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
            <span>الرئيس: {c.head ? (c.head.name || "—") : "غير معيّن"}</span>
            <span>المستودعات: {c._count.warehouses}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => setHeadFor(c)}>تغيير الرئيس</button>
            {(COMPANY_TRANSITIONS[c.status] ?? []).map((to) => (
              <button key={to} type="button" className={btnGhost} onClick={() => void setStatus(c.id, to)}>
                {c.status === "DETACHED" && to === "ACTIVE"
                  ? "إعادة تفعيل"
                  : to === "ACTIVE"
                    ? "تفعيل"
                    : to === "SUSPENDED"
                      ? "إيقاف"
                      : to === "DETACHING"
                        ? "بدء الفصل"
                        : "إتمام الفصل"}
              </button>
            ))}
          </div>
        </div>
      ))}
      {showNew && (
        <CompanyForm
          title="شركة جديدة"
          showKind
          onClose={() => setShowNew(false)}
          onSubmit={async (v) => {
            const body: Record<string, unknown> = { name: v.name, kind: v.kind };
            if (v.headUserId) body.headUserId = v.headUserId;
            const r = await api("/api/admin/logistics/companies", "POST", body);
            if (!r.ok) return r.message;
            setShowNew(false);
            await load();
            return "";
          }}
        />
      )}
      {headFor && (
        <CompanyForm
          title={"رئيس: " + headFor.name}
          initialName={headFor.name}
          showKind={false}
          onClose={() => setHeadFor(null)}
          onSubmit={async (v) => {
            if (!v.headUserId) return "اختر المستخدم الجديد";
            const r = await api("/api/admin/logistics/companies/" + headFor.id, "PATCH", { name: v.name, headUserId: v.headUserId });
            if (!r.ok) return r.message;
            setHeadFor(null);
            await load();
            return "";
          }}
        />
      )}
    </div>
  );
}