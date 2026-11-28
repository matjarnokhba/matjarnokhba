"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, FieldRow, btnGhost, btnPrimary, inputCls } from "./ui";

type Co = { id: number; code: string; name: string };
type Cfg = { mode: string; primaryCompanyId: number | null; fallbackCompanyId: number | null } | null;
type Plat = { id: number; code: string; name: string; kind: string; status: string; config: Cfg; companies: Co[] };
type CovData = { companies: Co[]; cities: { id: number; name: string }[]; coverage: { companyId: number; cityId: number }[] };

const MODES: { v: string; l: string }[] = [
  { v: "MANUAL", l: "يدوي (المنشئ يختار المستودع)" },
  { v: "AUTO", l: "تلقائي (الرئيسية ثم الاحتياطية)" },
  { v: "BY_CITY", l: "حسب مدينة الزبون" },
];
const MODE_LABEL: Record<string, string> = { MANUAL: "يدوي", AUTO: "تلقائي", BY_CITY: "حسب المدينة" };

async function call(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.success !== false, json, message: String(json.message ?? "") };
  } catch {
    return { ok: false, json: {} as any, message: "تعذّر الاتصال بالخادم" };
  }
}

function PlatformCard({ p, onSaved }: { p: Plat; onSaved: () => void }) {
  const [mode, setMode] = useState(p.config?.mode ?? "MANUAL");
  const [primary, setPrimary] = useState<number | "">(p.config?.primaryCompanyId ?? "");
  const [fallback, setFallback] = useState<number | "">(p.config?.fallbackCompanyId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await call("/api/admin/logistics/routing", "PUT", {
      platformId: p.id,
      mode,
      primaryCompanyId: primary === "" ? null : primary,
      fallbackCompanyId: fallback === "" ? null : fallback,
    });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? "تم الحفظ" : r.message || "تعذّر الحفظ" });
    if (r.ok) onSaved();
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold">{p.name}</p>
          <p className="text-xs text-gray-500">{p.code}</p>
        </div>
        <Badge text={MODE_LABEL[p.config?.mode ?? "MANUAL"] ?? "يدوي"} tone={p.config && p.config.mode !== "MANUAL" ? "green" : "gray"} />
      </div>
      {p.companies.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-2 text-sm text-gray-600">لا توجد شركة مرتبطة بهذه المنصة ربطاً نشطاً. اربطها أولاً من قسم المنصات.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <FieldRow label="نمط التوزيع">
            <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="الشركة الرئيسية">
            <select className={inputCls} value={primary} onChange={(e) => setPrimary(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">بدون</option>
              {p.companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="الشركة الاحتياطية (الدرع)">
            <select className={inputCls} value={fallback} onChange={(e) => setFallback(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">بدون</option>
              {p.companies.filter((c) => c.id !== primary).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FieldRow>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="button" className={btnPrimary} disabled={busy || p.companies.length === 0} onClick={() => void save()}>
          {busy ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        {msg && <span className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{msg.text}</span>}
      </div>
    </div>
  );
}

function CoverageEditor({ companyId, cities, initial, onSaved }: { companyId: number; cities: { id: number; name: string }[]; initial: number[]; onSaved: () => void }) {
  const [sel, setSel] = useState<number[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function toggle(id: number) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await call("/api/admin/logistics/coverage", "PUT", { companyId, cityIds: sel });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? "تم الحفظ" : r.message || "تعذّر الحفظ" });
    if (r.ok) onSaved();
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cities.map((c) => (
          <label key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 text-sm">
            <input type="checkbox" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} />
            <span>{c.name}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btnPrimary} disabled={busy} onClick={() => void save()}>
          {busy ? "جارٍ الحفظ..." : "حفظ التغطية"}
        </button>
        <button type="button" className={btnGhost} onClick={() => setSel([])}>إفراغ</button>
        <span className="text-xs text-gray-500">{sel.length} مدينة</span>
        {msg && <span className={msg.ok ? "text-sm text-green-700" : "text-sm text-red-600"}>{msg.text}</span>}
      </div>
    </div>
  );
}

export default function RoutingTab() {
  const [plats, setPlats] = useState<Plat[]>([]);
  const [cov, setCov] = useState<CovData | null>(null);
  const [companyId, setCompanyId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([call("/api/admin/logistics/routing", "GET"), call("/api/admin/logistics/coverage", "GET")]);
    if (!a.ok) setError(a.message || "تعذّر التحميل");
    else {
      setError("");
      setPlats(a.json.platforms ?? []);
    }
    if (b.ok) setCov({ companies: b.json.companies ?? [], cities: b.json.cities ?? [], coverage: b.json.coverage ?? [] });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="p-4 text-sm text-gray-500">جارٍ التحميل...</p>;
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;

  const initial = cov && companyId !== "" ? cov.coverage.filter((c) => c.companyId === companyId).map((c) => c.cityId) : [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-bold">توزيع الشحنات لكل منصة</h2>
        <p className="text-sm text-gray-600">اختر كيف تُسنَد شحنات كل منصة. هذه إعدادات فقط، ولا تغيّر عمل الشحنات القائمة قبل تفعيل التوزيع.</p>
        {plats.length === 0 && <p className="text-sm text-gray-500">لا توجد منصات.</p>}
        {plats.map((p) => (
          <PlatformCard key={p.id + "-" + (p.config?.mode ?? "x") + "-" + (p.config?.primaryCompanyId ?? 0) + "-" + (p.config?.fallbackCompanyId ?? 0)} p={p} onSaved={() => void load()} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">المدن التي تغطيها كل شركة</h2>
        <FieldRow label="الشركة">
          <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">اختر شركة</option>
            {(cov?.companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FieldRow>
        {cov && companyId !== "" && (
          <CoverageEditor key={String(companyId) + "-" + initial.join(",")} companyId={companyId} cities={cov.cities} initial={initial} onSaved={() => void load()} />
        )}
      </section>
    </div>
  );
}
