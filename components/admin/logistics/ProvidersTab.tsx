"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { api, Badge, Modal, FieldRow, inputCls, btnPrimary, btnGhost } from "./ui";
import {
  PROVIDER_STATUS_LABEL, providerTone, INTEGRATION_TYPE_LABEL, AUTH_LABEL, CANONICAL_UI_LABEL, CAPABILITY_OPTIONS,
  DEFAULT_CAPS, EXAMPLE_HTTP_CONFIG,
} from "@/lib/integration-labels";

const fmt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-GB") : "—");
const hookUrl = (token: string) => (typeof window !== "undefined" ? window.location.origin : "") + "/api/webhooks/courier/" + token;

function CopyBtn({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btnGhost}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "تم النسخ" : label}
    </button>
  );
}

function SecretModal({ title, secret, token, onClose }: { title: string; secret: string; token: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <p className="rounded-lg bg-yellow-50 p-2 text-sm font-bold text-yellow-800">احفظ السرّ الآن ولا تشاركه إلا مع الشركة؛ لن يظهر مرة أخرى. عند ضياعه يجب تدويره.</p>
        <div className="space-y-1">
          <div className="text-xs font-bold text-gray-600">رابط Webhook</div>
          <code className="block break-all rounded-lg bg-gray-100 p-2 text-xs" dir="ltr">{hookUrl(token)}</code>
          <CopyBtn text={hookUrl(token)} label="نسخ الرابط" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-gray-600">سرّ التوقيع (HMAC-SHA256، ترويسة x-signature)</div>
          <code className="block break-all rounded-lg bg-gray-100 p-2 text-xs" dir="ltr">{secret}</code>
          <CopyBtn text={secret} label="نسخ السرّ" />
        </div>
      </div>
    </Modal>
  );
}

function CapsPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
      {CAPABILITY_OPTIONS.map((c) => (
        <label key={c.key} className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={value.includes(c.key)}
            onChange={(e) => onChange(e.target.checked ? [...value, c.key] : value.filter((x) => x !== c.key))}
          />
          {c.label}
        </label>
      ))}
    </div>
  );
}

function NewProviderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: any) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("MANUAL");
  const [baseUrl, setBaseUrl] = useState("");
  const [auth, setAuth] = useState("BEARER");
  const [caps, setCaps] = useState<string[]>(DEFAULT_CAPS.MANUAL);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const body: Record<string, unknown> = { code: code.trim(), name: name.trim(), integrationType: type, capabilities: caps };
    if (type === "API") {
      if (baseUrl.trim()) body.baseUrl = baseUrl.trim();
      body.authScheme = auth;
    }
    if (notes.trim()) body.notes = notes.trim();
    const r = await api("/api/admin/logistics/providers", "POST", body);
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    onCreated(r.json);
  }

  return (
    <Modal title="شركة توصيل خارجية جديدة" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <FieldRow label="الكود (أحرف إنجليزية/أرقام/شرطة)">
          <input className={inputCls} dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AMANA-1" required />
        </FieldRow>
        <FieldRow label="اسم الشركة">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </FieldRow>
        <FieldRow label="طريقة الربط">
          <select
            className={inputCls}
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCaps(DEFAULT_CAPS[e.target.value] ?? []);
            }}
          >
            <option value="MANUAL">يدوي (بدون اتصال تقني)</option>
            <option value="API">API (قابل للضبط)</option>
            <option value="CSV" disabled>CSV/Excel (قريباً)</option>
          </select>
        </FieldRow>
        {type === "API" && (
          <>
            <FieldRow label="عنوان الـAPI (https فقط، نطاق عام)">
              <input className={inputCls} dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.courier.com" />
            </FieldRow>
            <FieldRow label="طريقة المصادقة">
              <select className={inputCls} value={auth} onChange={(e) => setAuth(e.target.value)}>
                {Object.entries(AUTH_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </FieldRow>
          </>
        )}
        <div className="space-y-1">
          <div className="text-xs font-bold text-gray-600">الإمكانيات الفعلية التي تدعمها الشركة</div>
          <CapsPicker value={caps} onChange={setCaps} />
        </div>
        <FieldRow label="ملاحظات (اختياري)">
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FieldRow>
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
        <button type="submit" disabled={busy} className={btnPrimary + " w-full"}>{busy ? "..." : "إنشاء"}</button>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <div className="text-sm font-bold">{title}</div>
      {children}
    </div>
  );
}

function DetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState<{ secret: string; token: string } | null>(null);
  const [rows, setRows] = useState<{ k: string; v: string }[]>([{ k: "", v: "" }, { k: "", v: "" }]);
  const [cfgText, setCfgText] = useState("");
  const [caps, setCaps] = useState<string[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [auth, setAuth] = useState("NONE");
  const [mapExt, setMapExt] = useState("");
  const [mapCan, setMapCan] = useState("DELIVERED");

  const load = useCallback(async () => {
    const r = await api("/api/admin/logistics/providers/" + id);
    if (!r.ok) return setErr(r.message);
    setData(r.json);
    const p = r.json.provider;
    setCaps(p.capabilities ?? []);
    setBaseUrl(p.baseUrl ?? "");
    setAuth(p.authScheme ?? "NONE");
    setCfgText(p.config ? JSON.stringify(p.config, null, 2) : "");
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    setErr("");
    setMsg("");
    const r = await api("/api/admin/logistics/providers/" + id, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    if (r.json.result && !r.json.result.ok) setErr("فشل الاختبار: " + (r.json.result.error ?? "سبب غير معروف"));
    else setMsg(okMsg);
    if (r.json.webhookSecret && data) setSecret({ secret: r.json.webhookSecret, token: data.provider.webhookToken });
    await load();
    onChanged();
  }

  if (!data) {
    return (
      <Modal title="شركة توصيل" onClose={onClose}>
        <p className="text-sm text-gray-500">{err || "جارٍ التحميل..."}</p>
      </Modal>
    );
  }
  const p = data.provider;
  const mappings: any[] = data.mappings ?? [];
  const isApi = p.integrationType === "API";
  const testsOk = p.connectionTestOk && p.shipmentTestOk;

  return (
    <Modal title={p.name + " — " + p.code} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge text={PROVIDER_STATUS_LABEL[p.status] ?? p.status} tone={providerTone(p.status)} />
          <Badge text={INTEGRATION_TYPE_LABEL[p.integrationType] ?? p.integrationType} tone="blue" />
          {p.activatedAt && <span className="text-xs text-gray-500">فُعّلت: {fmt(p.activatedAt)}</span>}
        </div>
        {msg && <p className="rounded-lg bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
        {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}

        <Section title="دورة التفعيل">
          <p className="text-xs text-gray-500">لا يُفعَّل المزوّد إلا بعد نجاح اختبار الاتصال واختبار الشحنة. أي تغيير في الإعدادات أو البيانات يعيده لمرحلة الاختبار.</p>
          <div className="flex flex-wrap gap-2">
            {p.status === "DRAFT" && (
              <button type="button" disabled={busy} className={btnPrimary} onClick={() => act({ action: "set_status", status: "TESTING" }, "انتقل لمرحلة الاختبار")}>نقل لمرحلة الاختبار</button>
            )}
            {p.status === "TESTING" && (
              <button type="button" disabled={busy || !testsOk} className={btnPrimary} onClick={() => act({ action: "set_status", status: "ACTIVE" }, "تم التفعيل")}>تفعيل</button>
            )}
            {p.status === "DISABLED" && (
              <button type="button" disabled={busy} className={btnPrimary} onClick={() => act({ action: "set_status", status: "TESTING" }, "أُعيد لمرحلة الاختبار")}>إعادة للاختبار</button>
            )}
            {(p.status === "TESTING" || p.status === "ACTIVE") && (
              <button
                type="button"
                disabled={busy}
                className={btnGhost}
                onClick={() => {
                  if (window.confirm("تعطيل هذه الشركة؟ لن تُرسل إليها شحنات جديدة.")) act({ action: "set_status", status: "DISABLED" }, "تم التعطيل");
                }}
              >
                تعطيل
              </button>
            )}
          </div>
        </Section>

        <Section title="الاختبارات">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-gray-50 p-2">
              اختبار الاتصال: <b>{p.connectionTestOk ? "نجح" : p.connectionTestedAt ? "فشل" : "لم يُنفّذ"}</b>
              <div className="text-gray-500">{fmt(p.connectionTestedAt)}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-2">
              اختبار الشحنة: <b>{p.shipmentTestOk ? "نجح" : p.shipmentTestedAt ? "فشل" : "لم يُنفّذ"}</b>
              <div className="text-gray-500">{fmt(p.shipmentTestedAt)}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className={btnGhost} onClick={() => act({ action: "test_connection" }, "نجح اختبار الاتصال")}>اختبار الاتصال</button>
            <button type="button" disabled={busy} className={btnGhost} onClick={() => act({ action: "test_shipment" }, "نجح اختبار الشحنة")}>اختبار شحنة</button>
          </div>
          {isApi && <p className="text-xs text-gray-500">اختبار الشحنة لا يُنشئ شحنة حقيقية: يتطلب testPath أو testBodyExtra (وضع تجريبي لدى الشركة).</p>}
        </Section>

        <Section title="Webhook (استقبال الحالات)">
          <code className="block break-all rounded-lg bg-gray-100 p-2 text-xs" dir="ltr">{hookUrl(p.webhookToken)}</code>
          <div className="flex gap-2">
            <CopyBtn text={hookUrl(p.webhookToken)} label="نسخ الرابط" />
            <button
              type="button"
              disabled={busy}
              className={btnGhost}
              onClick={() => {
                if (window.confirm("تدوير السرّ يبطل السرّ الحالي فوراً. متابعة؟")) act({ action: "rotate_webhook_secret" }, "تم التدوير");
              }}
            >
              تدوير السرّ
            </button>
          </div>
        </Section>

        <Section title="بيانات الاتصال (مشفّرة — لا تُعرض)">
          <p className="text-xs text-gray-600">
            الحقول المحفوظة: {p.credentialsKeys?.length ? <b dir="ltr">{p.credentialsKeys.join(", ")}</b> : "لا شيء"}
          </p>
          <p className="text-xs text-gray-500">أمثلة: token أو apiKey أو username وpassword أو accountId. الحفظ يستبدل كل القيم السابقة.</p>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input className={inputCls} dir="ltr" placeholder="الاسم" value={r.k} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
              <input className={inputCls} dir="ltr" type="password" autoComplete="off" placeholder="القيمة" value={r.v} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => setRows([...rows, { k: "", v: "" }])}>+ حقل</button>
            <button
              type="button"
              disabled={busy}
              className={btnPrimary}
              onClick={async () => {
                const fields: Record<string, string> = {};
                for (const r of rows) if (r.k.trim() && r.v) fields[r.k.trim()] = r.v;
                if (Object.keys(fields).length === 0) return setErr("أدخل حقلاً واحداً على الأقل");
                await act({ action: "set_credentials", fields }, "تم حفظ البيانات مشفّرة");
                setRows([{ k: "", v: "" }, { k: "", v: "" }]);
              }}
            >
              حفظ مشفّراً
            </button>
            {p.hasCredentials && (
              <button
                type="button"
                disabled={busy}
                className={btnGhost}
                onClick={() => {
                  if (window.confirm("مسح كل بيانات الاتصال؟")) act({ action: "clear_credentials" }, "تم المسح");
                }}
              >
                مسح
              </button>
            )}
          </div>
        </Section>

        <Section title="الإعدادات الأساسية والإمكانيات">
          {isApi && (
            <>
              <FieldRow label="عنوان الـAPI">
                <input className={inputCls} dir="ltr" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </FieldRow>
              <FieldRow label="طريقة المصادقة">
                <select className={inputCls} value={auth} onChange={(e) => setAuth(e.target.value)}>
                  {Object.entries(AUTH_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </FieldRow>
            </>
          )}
          <CapsPicker value={caps} onChange={setCaps} />
          <button
            type="button"
            disabled={busy}
            className={btnPrimary}
            onClick={() => {
              const body: Record<string, unknown> = { action: "update", capabilities: caps };
              if (isApi) {
                if (baseUrl.trim() && baseUrl.trim() !== (p.baseUrl ?? "")) body.baseUrl = baseUrl.trim();
                if (auth !== p.authScheme) body.authScheme = auth;
              }
              act(body, "تم حفظ الإعدادات");
            }}
          >
            حفظ
          </button>
        </Section>

        {isApi && (
          <Section title="إعدادات اتصال API (JSON)">
            <p className="text-xs text-gray-500">
              تُملأ القوالب من الطلب الموحد مثل {"{{reference}}"} و{"{{recipient.name}}"} و{"{{cod}}"}، ومن بيانات الاعتماد مثل {"{{cred.accountId}}"}. الترويسات الحساسة يجب أن تأخذ قيمتها من {"{{cred.اسم}}"}.
            </p>
            <textarea className={inputCls + " font-mono text-xs"} dir="ltr" rows={12} value={cfgText} onChange={(e) => setCfgText(e.target.value)} placeholder="{ ... }" />
            <div className="flex gap-2">
              <button type="button" className={btnGhost} onClick={() => setCfgText(EXAMPLE_HTTP_CONFIG)}>قالب مثال</button>
              <button
                type="button"
                disabled={busy}
                className={btnPrimary}
                onClick={() => {
                  let cfg: unknown;
                  try {
                    cfg = JSON.parse(cfgText);
                  } catch {
                    return setErr("JSON غير صالح");
                  }
                  act({ action: "set_config", config: cfg }, "تم حفظ الإعدادات (أُعيد الاختبار)");
                }}
              >
                حفظ الإعدادات
              </button>
            </div>
          </Section>
        )}

        <Section title={"ربط الحالات (" + mappings.length + ")"}>
          <p className="text-xs text-gray-500">حالة الشركة الأصلية تُحفظ دائماً في الأحداث؛ هذا الجدول يحدد فقط الحالة الموحدة المقابلة.</p>
          <button type="button" disabled={busy} className={btnGhost} onClick={() => act({ action: "apply_default_mappings" }, "طُبّق الربط الافتراضي (عربي/فرنسي/إنجليزي)")}>تطبيق الربط الافتراضي</button>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className={inputCls} placeholder="حالة الشركة" value={mapExt} onChange={(e) => setMapExt(e.target.value)} />
            <select className={inputCls} value={mapCan} onChange={(e) => setMapCan(e.target.value)}>
              {Object.entries(CANONICAL_UI_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !mapExt.trim()}
              className={btnGhost}
              onClick={async () => {
                await act({ action: "set_mappings", mappings: [{ externalStatus: mapExt.trim(), canonicalStatus: mapCan }] }, "تمت الإضافة");
                setMapExt("");
              }}
            >
              إضافة
            </button>
          </div>
          <div className="max-h-48 divide-y overflow-y-auto rounded-lg border border-gray-100 text-xs">
            {mappings.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-2 py-1">
                <span dir="auto">{m.externalStatus}</span>
                <span className="text-gray-600">{CANONICAL_UI_LABEL[m.canonicalStatus] ?? m.canonicalStatus}</span>
              </div>
            ))}
            {mappings.length === 0 && <div className="p-2 text-gray-400">لا توجد تعيينات</div>}
          </div>
        </Section>
      </div>
      {secret && <SecretModal title="سرّ Webhook الجديد" secret={secret.secret} token={secret.token} onClose={() => setSecret(null)} />}
    </Modal>
  );
}

function HealthBar({ h, names }: { h: any; names: Record<number, string> }) {
  const items: { label: string; v: number }[] = [
    { label: "فشل يحتاج تدخلاً", v: h.failedNeedsAttention },
    { label: "بانتظار إعادة المحاولة", v: h.retryDue },
    { label: "إرسال عالق", v: h.stuckSubmitting },
    { label: "بلا تحديث +48 ساعة", v: h.silentOver48h },
  ];
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <div className="text-sm font-bold">صحة المزامنة</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className={"rounded-lg p-2 text-center " + (i.v > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700")}>
            <div className="text-lg font-bold">{i.v}</div>
            <div className="text-[11px]">{i.label}</div>
          </div>
        ))}
      </div>
      {h.providers24h?.length > 0 && (
        <div className="text-xs text-gray-600">
          آخر 24 ساعة:{" "}
          {h.providers24h.map((p: any) => (names[p.providerId] ?? "#" + p.providerId) + " " + p.ok + "/" + p.total).join(" — ")}
        </div>
      )}
    </div>
  );
}

export default function ProvidersTab() {
  const [list, setList] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [secret, setSecret] = useState<{ secret: string; token: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([api("/api/admin/logistics/providers"), api("/api/admin/logistics/integration-health")]);
    setLoading(false);
    if (!a.ok) return setErr(a.message);
    setErr("");
    setList(a.json.providers ?? []);
    if (b.ok) setHealth(b.json.health);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const names: Record<number, string> = {};
  for (const p of list) names[p.id] = p.name;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">شركات التوصيل الخارجية</h2>
        <button type="button" className={btnPrimary + " flex items-center gap-1"} onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> شركة جديدة
        </button>
      </div>
      {health && <HealthBar h={health} names={names} />}
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {loading && <p className="text-sm text-gray-500">جارٍ التحميل...</p>}
      {!loading && list.length === 0 && !err && <p className="text-sm text-gray-500">لا توجد شركات توصيل خارجية بعد.</p>}
      <div className="space-y-2">
        {list.map((p) => (
          <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="w-full space-y-1 rounded-xl border border-gray-200 p-3 text-right hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="font-bold">{p.name}</span>
              <Badge text={PROVIDER_STATUS_LABEL[p.status] ?? p.status} tone={providerTone(p.status)} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span dir="ltr">{p.code}</span>
              <Badge text={INTEGRATION_TYPE_LABEL[p.integrationType] ?? p.integrationType} tone="blue" />
              <span>اتصال: {p.connectionTestOk ? "✓" : "✗"}</span>
              <span>شحنة: {p.shipmentTestOk ? "✓" : "✗"}</span>
              <span>{p.hasCredentials ? "بيانات محفوظة" : "بلا بيانات اتصال"}</span>
              <span>شركات مرتبطة: {p._count?.companies ?? 0}</span>
            </div>
          </button>
        ))}
      </div>
      {showNew && (
        <NewProviderModal
          onClose={() => setShowNew(false)}
          onCreated={(j) => {
            setShowNew(false);
            setSecret({ secret: j.webhookSecret, token: j.provider.webhookToken });
            load();
          }}
        />
      )}
      {secret && <SecretModal title="سرّ Webhook (يُعرض مرة واحدة)" secret={secret.secret} token={secret.token} onClose={() => setSecret(null)} />}
      {openId !== null && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}