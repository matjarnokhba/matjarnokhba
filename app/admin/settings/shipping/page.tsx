"use client";

import { useEffect, useState } from "react";
import { Truck, Loader2, Save } from "lucide-react";

export default function AdminShippingSettings() {
  const [isFreeEnabled, setIsFreeEnabled] = useState(false);
  const [threshold, setThreshold] = useState("300");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings/shipping");
        const data = await res.json();
        if (data.success) {
          setIsFreeEnabled(data.isFreeShippingEnabled);
          setThreshold(data.freeShippingThreshold.toString());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/settings/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFreeShippingEnabled: isFreeEnabled,
          freeShippingThreshold: Number(threshold),
        }),
      });
      if (res.ok) {
        setMsg("تم حفظ الإعدادات بنجاح!");
        setTimeout(() => setMsg(""), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-[#ff5c00]" />
          إعدادات الشحن
        </h1>
        <p className="text-sm text-gray-500 mt-1">تحكم في عروض الشحن المجاني للمتجر</p>
      </div>

      <form onSubmit={handleSave} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div>
            <div className="font-bold text-gray-900">تفعيل الشحن المجاني</div>
            <div className="text-xs text-gray-500 mt-1">عند التفعيل، سيحصل الزبون على شحن مجاني إذا تجاوز سقف معين.</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer"
              checked={isFreeEnabled}
              onChange={(e) => setIsFreeEnabled(e.target.checked)}
            />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff5c00]"></div>
          </label>
        </div>

        {isFreeEnabled && (
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">سقف الشحن المجاني (د.م)</label>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              min="1"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
            />
            <p className="text-[11px] text-gray-500 mt-2">
              إذا كان إجمالي سلة الزبون {threshold} درهماً أو أكثر، لن يدفع رسوم الشحن.
            </p>
          </div>
        )}

        {msg && <div className="text-sm font-bold text-green-600 bg-green-50 p-2 rounded-lg text-center">{msg}</div>}

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ الإعدادات
        </button>
      </form>
    </div>
  );
}