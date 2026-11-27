"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { api, inputCls, btnGhost } from "./ui";

const COUNT_LABEL: Record<string, string> = {
  APPLIED: "حالات طُبّقت",
  DUPLICATE: "حالات مكررة (تجاهلتها)",
  IGNORED: "حُفظت دون تطبيق (متأخرة أو بعد حالة نهائية)",
  UNMAPPED: "حالات غير مربوطة (أضفها في ربط الحالات)",
  NOT_FOUND: "غير موجودة",
};

export default function CsvPanel({ providers, onDone }: { providers: any[]; onDone: () => void }) {
  const list = providers.filter((p) => p.integrationType === "CSV" || p.integrationType === "MANUAL");
  const [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<any>(null);

  async function onFile(f: File | undefined) {
    if (!f || !pid) return;
    setErr("");
    setRes(null);
    if (f.size > 1_000_000) return setErr("الملف كبير (الحد 1 ميغابايت)");
    setBusy(true);
    const text = await f.text();
    const r = await api("/api/logistics/external-shipments/import", "POST", { providerId: Number(pid), csv: text });
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    setRes(r.json.result);
    onDone();
  }

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 p-3">
      <div className="text-sm font-bold">ملفات CSV / Excel (لشركات بلا API)</div>
      <select className={inputCls} value={pid} onChange={(e) => setPid(e.target.value)}>
        <option value="">اختر شركة (CSV أو يدوي)</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        {pid ? (
          <a className={btnGhost + " block text-center"} href={"/api/logistics/external-shipments/export?providerId=" + pid} download>تحميل ملف الشحنات</a>
        ) : (
          <span className={btnGhost + " block text-center opacity-50"}>تحميل ملف الشحنات</span>
        )}
        <label className={btnGhost + " block cursor-pointer text-center" + (!pid || busy ? " opacity-50" : "")}>
          {busy ? "..." : "رفع ملف الحالات"}
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            disabled={!pid || busy}
            onChange={(e) => {
              const input = e.target;
              const f = input.files?.[0];
              input.value = "";
              onFile(f);
            }}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        أرسل الملف المحمّل للشركة. وعند وصول ملفها (أعمدة: reference أو tracking، ثم status، وdate اختياري) ارفعه هنا. في Excel احفظه بصيغة CSV UTF-8. إعادة رفع نفس الملف لا تكرّر شيئاً. الحد 300 صف في المرة.
      </p>
      {err && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      {res && (
        <div className="space-y-1 rounded-lg bg-gray-50 p-2 text-xs">
          <div>عدد الصفوف: <b>{res.total}</b> | تتبع محدّث: <b>{res.trackingUpdated}</b> | غير مطابقة: <b>{res.notFound}</b></div>
          {Object.entries(res.counts ?? {}).map(([k, v]) => (
            <div key={k}>{COUNT_LABEL[k] ?? k}: <b>{String(v)}</b></div>
          ))}
          {res.errors?.length > 0 && (
            <div className="max-h-32 overflow-y-auto text-red-700">
              {res.errors.map((e: any, i: number) => (
                <div key={i}>سطر {e.line} {e.ref ? "(" + e.ref + ")" : ""}: {e.message}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}