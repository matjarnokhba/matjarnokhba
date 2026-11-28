"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const input = "w-full rounded-lg border border-gray-300 p-2 text-sm";

export default function LogisticsRegisterPage() {
  const [f, setF] = useState({ name: "", email: "", password: "", companyName: "", phone: "", city: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  function set(k: keyof typeof f, v: string) {
    setF((s) => ({ ...s, [k]: v }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/logistics/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...f, city: f.city || null, note: f.note || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success) setDone(String(json.message ?? "تم استلام طلبك"));
      else setErr(String(json.message ?? "تعذّر إرسال الطلب"));
    } catch {
      setErr("تعذّر الاتصال بالخادم");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-lg font-bold text-green-800">{done}</p>
          <p className="mt-2 text-sm text-gray-600">بعد الموافقة تسجّل الدخول بالبريد وكلمة المرور التي أدخلتها.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-1 text-xl font-bold">تسجيل شركة توصيل</h1>
      <p className="mb-4 text-sm text-gray-600">أنشئ حساب شركتك. تراجع الإدارة الطلب ثم تُفعَّل شركتك.</p>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <input className={input} placeholder="اسمك الكامل" value={f.name} onChange={(e) => set("name", e.target.value)} required />
        <input className={input} type="email" placeholder="البريد الإلكتروني" value={f.email} onChange={(e) => set("email", e.target.value)} required />
        <input className={input} type="password" placeholder="كلمة المرور (8 أحرف على الأقل)" value={f.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
        <input className={input} placeholder="اسم شركة التوصيل" value={f.companyName} onChange={(e) => set("companyName", e.target.value)} required />
        <input className={input} placeholder="رقم الهاتف" value={f.phone} onChange={(e) => set("phone", e.target.value)} required />
        <input className={input} placeholder="المدينة (اختياري)" value={f.city} onChange={(e) => set("city", e.target.value)} />
        <textarea className={input} placeholder="نبذة عن الشركة (اختياري)" rows={3} value={f.note} onChange={(e) => set("note", e.target.value)} />
        {err && <p className="text-sm font-bold text-red-600">{err}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-[#ff5c00] p-2 font-bold text-white disabled:opacity-60">
          {busy ? "جارٍ الإرسال..." : "إرسال الطلب"}
        </button>
      </form>
    </main>
  );
}
