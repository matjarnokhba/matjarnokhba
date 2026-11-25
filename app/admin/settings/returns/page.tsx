"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Truck } from "lucide-react";

export default function ReturnSettingsPage() {
  const [fee, setFee] = useState("20");
  const [autoApprove, setAutoApprove] = useState(true);
  const [strikeLimit, setStrikeLimit] = useState("3");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings/return-shipping")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setFee(String(d.defaultFee));
          setAutoApprove(d.autoApprove !== false);
          setStrikeLimit(String(d.strikeLimit ?? 3));
        }
      })
      .catch(() => setMsg("فشل التحميل"))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/settings/return-shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultFee: Number(fee), autoApprove, strikeLimit: Number(strikeLimit) }),
      });
      const d = await res.json();
      setMsg(res.ok && d.success ? "تم الحفظ بنجاح!" : d.message || "فشل الحفظ");
      setTimeout(() => setMsg(""), 3000);
    } catch {
      setMsg("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
        <Truck className="h-6 w-6 text-[#ff5c00]" />
        إعدادات الإرجاع
      </h1>
      <form onSubmit={save} className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-bold text-gray-700">
            رسوم شحن المرتجع الافتراضية (د.م)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
          />
          <ul className="mt-2 list-disc space-y-1 pe-5 text-xs text-gray-600">
            <li>الأولوية 1: رقم يكتبه الأدمن عند الموافقة على إرجاع معيّن.</li>
            <li>الأولوية 2: سعر الشحن الأصلي للطلب نفسه.</li>
            <li>الأولوية 3: هذه القيمة، وتُستعمل عندما يكون الطلب بشحن مجاني.</li>
          </ul>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span className="text-sm">
            <span className="block font-bold text-gray-800">الاعتماد التلقائي بعد 48 ساعة</span>
            <span className="block text-xs text-gray-600">
              إرجاع بسبب عيب أو خطأ مع دليل مرفق، لم يتصرف فيه الأدمن خلال 48 ساعة، يُعتمد تلقائياً ويُحتسب الخطأ على
              التاجر. عند التعطيل يصلك تنبيه فقط ولا يُعتمد شيء دون قرارك.
            </span>
          </span>
        </label>

        <div>
          <label className="mb-1 block text-sm font-bold text-gray-700">
            تنبيه الأدمن بعد كم خطأ متكرر من نفس النوع (خلال 90 يوماً)
          </label>
          <input
            type="number"
            min="0"
            max="20"
            step="1"
            value={strikeLimit}
            onChange={(e) => setStrikeLimit(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
          />
          <p className="mt-1 text-xs text-gray-600">
            الافتراضي 3. اكتب 0 لتعطيل التنبيه. لا يوجد إيقاف تلقائي للتجار: أنت تقرر الإيقاف أو السماح من صفحة التجار.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ
        </button>
        {msg && <p className="text-sm font-bold text-green-700">{msg}</p>}
      </form>
    </div>
  );
}