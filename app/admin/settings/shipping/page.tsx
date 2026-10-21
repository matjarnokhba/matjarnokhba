"use client";

import { useEffect, useState } from "react";
import { Settings, Loader2, Save, Percent, Truck } from "lucide-react";

export default function AdminSettingsPage() {
  // حالة الشحن
  const [isFreeEnabled, setIsFreeEnabled] = useState(false);
  const [threshold, setThreshold] = useState("300");
  
  // حالة العمولة
  const [commissionRate, setCommissionRate] = useState("10");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function load() {
      try {
        // جلب إعدادات الشحن
        const shipRes = await fetch("/api/admin/settings/shipping");
        const shipData = await shipRes.json();
        if (shipData.success) {
          setIsFreeEnabled(shipData.isFreeShippingEnabled);
          setThreshold(shipData.freeShippingThreshold.toString());
        }

        // جلب إعدادات العمولة
        const commRes = await fetch("/api/admin/settings/commission");
        const commData = await commRes.json();
        if (commData.success) {
          setCommissionRate((commData.rate * 100).toString());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveShipping(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/admin/settings/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFreeShippingEnabled: isFreeEnabled,
          freeShippingThreshold: Number(threshold),
        }),
      });
      setMsg("تم حفظ إعدادات الشحن بنجاح!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCommission(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      await fetch("/api/admin/settings/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rate: Number(commissionRate) / 100,
        }),
      });
      setMsg("تم حفظ نسبة العمولة بنجاح!");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#ff5c00]" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-3xl mx-auto space-y-6" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Settings className="h-6 w-6 text-[#ff5c00]" />
          إعدادات المتجر
        </h1>
        <p className="text-sm text-gray-500 mt-1">التحكم في العمولات وسياسة الشحن</p>
      </div>

      {msg && <div className="text-sm font-bold text-green-600 bg-green-50 p-3 rounded-lg text-center">{msg}</div>}

      {/* إعدادات الشحن */}
      <form onSubmit={handleSaveShipping} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2 border-b pb-2">
          <Truck className="h-5 w-5 text-blue-600" /> إعدادات الشحن
        </h2>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div>
            <div className="font-bold text-gray-900">تفعيل الشحن المجاني</div>
            <div className="text-xs text-gray-500 mt-1">عند التفعيل، سيحصل الزبون على شحن مجاني إذا تجاوز سقف معين.</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={isFreeEnabled} onChange={(e) => setIsFreeEnabled(e.target.checked)} />
            <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff5c00]"></div>
          </label>
        </div>

        {isFreeEnabled && (
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700">سقف الشحن المجاني (د.م)</label>
            <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} min="1" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
          </div>
        )}

        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-lg bg-[#0a1f44] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#1a2f54] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ إعدادات الشحن
        </button>
      </form>

      {/* إعدادات العمولة */}
      <form onSubmit={handleSaveCommission} className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2 border-b pb-2">
          <Percent className="h-5 w-5 text-green-600" /> نسبة العمولة الافتراضية
        </h2>
        <div>
          <label className="mb-1 block text-sm font-bold text-gray-700">نسبة العمولة (%)</label>
          <input type="number" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} min="0" max="100" step="0.1" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]" />
          <p className="text-[11px] text-gray-500 mt-2">
            هذه النسبة ستُخصم من أرباح التاجر عند التسليم (ما لم تكن هناك نسبة مخصصة للتاجر).
          </p>
        </div>
        <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ نسبة العمولة
        </button>
      </form>
    </div>
  );
}