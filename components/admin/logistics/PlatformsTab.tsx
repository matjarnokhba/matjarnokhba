"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import { statusTone } from "@/lib/logistics-labels";
import { PLATFORM_STATUS_LABEL, PLATFORM_KIND_LABEL, LINK_STATUS_LABEL, linkTone } from "@/lib/logistics-transfer-labels";
import type { CompanyRow } from "./types";

function ask(msg: string): string | null {
  const v = window.prompt(msg);
  return v && v.trim().length >= 3 ? v.trim() : null;
}

function KeyModal({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="مفتاح API (يُعرض مرة واحدة)" onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-lg bg-yellow-50 p-2 text-sm font-bold text-yellow-800">
          احفظ المفتاح الآن وسلّمه للمنصة بطريقة آمنة. لن يظهر مرة أخرى؛ عند ضياعه يجب تدويره.
        </p>
        <code className="block break-all rounded-lg bg-gray-100 p-3 text-sm" dir="ltr">{apiKey}</code>
        <button
          type="button"
          className={btnPrimary + " w-full"}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(apiKey);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "تم النسخ" : "نسخ المفتاح"}
        </button>
      </div>
    </Modal>
  );
}

function NewPlatformModal({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hook, setHook] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body: Record<string, unknown> = { code: code.trim(), name: name.trim() };
    if (email.trim()) body.contactEmail = email.trim();
    if (hook.trim()) body.webhookUrl = hook.trim();
    const r = await api("/api/admin/logistics/platforms", "POST", body);
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    onCreated(r.json.apiKey as string);
  }

  return (
    <Modal title="منصة عميلة جديدة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="الكود (إنجليزي، مثال: SHOP-1)">
          <input className={inputCls} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} required />
        </FieldRow>
        <FieldRow label="اسم المنصة">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </FieldRow>
        <FieldRow label="بريد التواصل (اختياري)">
          <input className={inputCls} dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FieldRow>
        <FieldRow label="رابط Webhook (https، اختياري)">
          <input className={inputCls} dir="ltr" value={hook} onChange={(e) => setHook(e.target.value)} />
        </FieldRow>
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary + " w-full"}>
          {busy ? "جارٍ الإنشاء..." : "إنشاء وتوليد المفتاح"}
        </button>
      </form>
    </Modal>
  );
}

function NewLinkModal({ companies, platforms, onClose, onDone }: { companies: CompanyRow[]; platforms: any[]; onClose: () => void; onDone: () => void }) {
  const [companyId, setCompanyId] = useState("");
  const [platformId, setPlatformId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await api("/api/admin/logistics/platform-links", "POST", { companyId: Number(companyId), platformId: Number(platformId) });
    setBusy(false);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    onDone();
  }

  return (
    <Modal title="ربط شركة بمنصة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="الشركة">
          <select className={inputCls} value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
            <option value="">اختر...</option>
            {companies.filter((c) => c.status === "ACTIVE").map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="المنصة">
          <select className={inputCls} value={platformId} onChange={(e) => setPlatformId(e.target.value)} required>
            <option value="">اختر...</option>
            {platforms.filter((p) => p.status === "ACTIVE").map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({PLATFORM_KIND_LABEL[p.kind] ?? p.kind})</option>
            ))}
          </select>
        </FieldRow>
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary + " w-full"}>
          {busy ? "جارٍ الربط..." : "ربط"}
        </button>
      </form>
    </Modal>
  );
}

export default function PlatformsTab() {
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [companies, setCompanies] = useState<(CompanyRow & { allowExternalPlatforms?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showPlatform, setShowPlatform] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [shownKey, setShownKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, l, c] = await Promise.all([
      api("/api/admin/logistics/platforms"),
      api("/api/admin/logistics/platform-links"),
      api("/api/admin/logistics/companies"),
    ]);
    if (p.ok) setPlatforms(p.json.platforms as any[]);
    else setErr(p.message);
    if (l.ok) setLinks(l.json.links as any[]);
    if (c.ok) setCompanies(c.json.companies as any[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function platformAct(id: number, body: Record<string, unknown>) {
    const r = await api("/api/admin/logistics/platforms/" + id, "PATCH", body);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setErr("");
    if (r.json.apiKey) setShownKey(r.json.apiKey as string);
    await load();
  }

  async function linkAct(id: number, body: Record<string, unknown>) {
    const r = await api("/api/admin/logistics/platform-links/" + id, "PATCH", body);
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setErr("");
    await load();
  }

  async function setExternal(companyId: number, allow: boolean) {
    const r = await api("/api/admin/logistics/companies/" + companyId + "/external-access", "PATCH", { allow });
    if (!r.ok) {
      setErr(r.message);
      return;
    }
    setErr("");
    await load();
  }

  return (
    <div className="space-y-4">
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm font-bold text-red-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">المنصات العميلة ({platforms.length})</h2>
          <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowPlatform(true)}>
            <Plus className="h-4 w-4" /> منصة
          </button>
        </div>
        {platforms.map((p) => (
          <div key={p.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-xs text-gray-500" dir="ltr">{p.code}{p.apiKeyPrefix ? " · nkp_" + p.apiKeyPrefix + "…" : ""}</p>
              </div>
              <div className="flex gap-1">
                <Badge text={PLATFORM_KIND_LABEL[p.kind] ?? p.kind} tone="blue" />
                <Badge text={PLATFORM_STATUS_LABEL[p.status] ?? p.status} tone={statusTone(p.status)} />
              </div>
            </div>
            <p className="text-xs text-gray-500">الشركات المرتبطة: {p._count?.links ?? 0} · الشحنات: {p._count?.shipments ?? 0}</p>
            {p.statusReason && <p className="text-xs text-yellow-700">السبب: {p.statusReason}</p>}
            {p.kind === "EXTERNAL" && (
              <div className="flex flex-wrap gap-2">
                {p.status === "ACTIVE" && (
                  <>
                    <button type="button" className={btnGhost} onClick={() => { const n = ask("سبب التعليق"); if (n) void platformAct(p.id, { action: "suspend", reason: n }); }}>تعليق</button>
                    <button type="button" className={btnGhost} onClick={() => { if (confirm("تدوير المفتاح يُبطل القديم فوراً. متابعة؟")) void platformAct(p.id, { action: "rotate_key" }); }}>تدوير المفتاح</button>
                  </>
                )}
                {p.status !== "ACTIVE" && (
                  <button type="button" className={btnGhost} onClick={() => void platformAct(p.id, { action: "activate" })}>تفعيل</button>
                )}
                {p.status !== "REVOKED" && (
                  <button type="button" className={btnGhost} onClick={() => { const n = ask("سبب الإلغاء"); if (n) void platformAct(p.id, { action: "revoke", reason: n }); }}>إلغاء</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">ربط الشركات بالمنصات ({links.length})</h2>
          <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowLink(true)}>
            <Plus className="h-4 w-4" /> ربط
          </button>
        </div>
        {links.map((l) => (
          <div key={l.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{l.company?.name} ↔ {l.platform?.name}</p>
              <Badge text={LINK_STATUS_LABEL[l.status] ?? l.status} tone={linkTone(l.status)} />
            </div>
            {l.pauseReason && l.status === "PAUSED" && <p className="text-xs text-yellow-700">سبب الإيقاف: {l.pauseReason}</p>}
            {l.revokeReason && l.status === "REVOKED" && <p className="text-xs text-red-700">سبب الإلغاء: {l.revokeReason}</p>}
            <div className="flex flex-wrap gap-2">
              {l.status === "ACTIVE" && (
                <button type="button" className={btnGhost} onClick={() => { const n = ask("سبب إيقاف الربط"); if (n) void linkAct(l.id, { action: "pause", reason: n }); }}>إيقاف مؤقت</button>
              )}
              {l.status === "PAUSED" && (
                <button type="button" className={btnGhost} onClick={() => void linkAct(l.id, { action: "resume" })}>استئناف</button>
              )}
              {l.status !== "REVOKED" && (
                <button type="button" className={btnGhost} onClick={() => { const n = ask("سبب إلغاء الربط"); if (n) void linkAct(l.id, { action: "revoke", reason: n }); }}>إلغاء الربط</button>
              )}
              {l.status === "REVOKED" && (
                <button type="button" className={btnGhost} onClick={() => void linkAct(l.id, { action: "reinstate" })}>إعادة تفعيل</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">السماح بالمنصات الخارجية</h2>
        <p className="text-xs text-gray-500">الشركة لا تعمل مع منصات خارجية إلا إذا سمحتَ لها هنا. منصتنا لا تحتاج هذا السماح.</p>
        {companies.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
            <div>
              <p className="font-bold">{c.name}</p>
              {typeof c.allowExternalPlatforms === "boolean" && (
                <Badge text={c.allowExternalPlatforms ? "مسموح" : "غير مسموح"} tone={c.allowExternalPlatforms ? "green" : "gray"} />
              )}
            </div>
            <button type="button" className={btnGhost} onClick={() => void setExternal(c.id, !(c.allowExternalPlatforms ?? false))}>
              {c.allowExternalPlatforms ? "منع" : "السماح"}
            </button>
          </div>
        ))}
      </div>

      {showPlatform && (
        <NewPlatformModal
          onClose={() => setShowPlatform(false)}
          onCreated={(k) => {
            setShowPlatform(false);
            setShownKey(k);
            void load();
          }}
        />
      )}
      {showLink && (
        <NewLinkModal
          companies={companies}
          platforms={platforms}
          onClose={() => setShowLink(false)}
          onDone={() => {
            setShowLink(false);
            void load();
          }}
        />
      )}
      {shownKey && <KeyModal apiKey={shownKey} onClose={() => setShownKey(null)} />}
    </div>
  );
}