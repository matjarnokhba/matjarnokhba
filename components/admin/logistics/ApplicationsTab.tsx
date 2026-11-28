"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, btnGhost, btnPrimary, inputCls } from "./ui";

type App = {
  id: number;
  code: string;
  name: string;
  status: string;
  contactPhone: string | null;
  contactEmail: string | null;
  createdAt: string;
  settings: any;
  head: { id: number; name: string; email: string } | null;
};

async function call(url: string, method: string, body?: unknown) {
  try {
    const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok && json.success !== false, json, message: String(json.message ?? "") };
  } catch {
    return { ok: false, json: {} as any, message: "تعذّر الاتصال بالخادم" };
  }
}

function Row({ a, onDone }: { a: App; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const app = a.settings?.application ?? {};

  async function decide(action: "approve" | "reject") {
    setBusy(true);
    setMsg("");
    const r = await call("/api/admin/logistics/applications/" + a.id, "POST", { action, reason: reason || null });
    setBusy(false);
    if (r.ok) onDone();
    else setMsg(r.message || "تعذّر التنفيذ");
  }

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold">{a.name}</p>
          <p className="text-xs text-gray-500">{a.code}</p>
        </div>
        <Badge text={a.status === "PENDING" ? "قيد المراجعة" : "مرفوضة"} tone={a.status === "PENDING" ? "gray" : "red"} />
      </div>
      <p className="text-sm text-gray-700">
        {a.head ? a.head.name + " — " + a.head.email : "بدون صاحب"} {a.contactPhone ? " — " + a.contactPhone : ""}
      </p>
      {app.city && <p className="text-sm text-gray-600">المدينة: {app.city}</p>}
      {app.note && <p className="text-sm text-gray-600">{app.note}</p>}
      {a.status === "REJECTED" && app.rejectedReason && <p className="text-sm text-red-600">سبب الرفض: {app.rejectedReason}</p>}
      {a.status === "PENDING" && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btnPrimary} disabled={busy} onClick={() => void decide("approve")}>قبول وتفعيل</button>
          <input className={inputCls + " max-w-xs"} placeholder="سبب الرفض (اختياري)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button type="button" className={btnGhost} disabled={busy} onClick={() => void decide("reject")}>رفض</button>
        </div>
      )}
      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

export default function ApplicationsTab() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await call("/api/admin/logistics/applications", "GET");
    if (r.ok) {
      setError("");
      setApps(r.json.applications ?? []);
    } else setError(r.message || "تعذّر التحميل");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="p-4 text-sm text-gray-500">جارٍ التحميل...</p>;
  if (error) return <p className="p-4 text-sm text-red-600">{error}</p>;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">طلبات تسجيل شركات التوصيل</h2>
      <p className="text-sm text-gray-600">رابط التسجيل للشركات: /logistics/register. عند القبول تُفعَّل الشركة ويصبح صاحبها مديرها.</p>
      {apps.length === 0 && <p className="text-sm text-gray-500">لا توجد طلبات.</p>}
      {apps.map((a) => (
        <Row key={a.id + "-" + a.status} a={a} onDone={() => void load()} />
      ))}
    </div>
  );
}
