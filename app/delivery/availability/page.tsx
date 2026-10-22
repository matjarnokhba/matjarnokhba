"use client";

import { useEffect, useState } from "react";
import { Loader2, Calendar, Save, Plus, AlertCircle } from "lucide-react";

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function DeliveryAvailabilityPage() {
  const [weeklyDayOff, setWeeklyDayOff] = useState<string>("");
  const [daysOff, setDaysOff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // نموذج إضافة غياب
  const [newDate, setNewDate] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/delivery/availability");
      const data = await res.json();
      if (data.success) {
        setWeeklyDayOff(data.weeklyDayOff !== null ? data.weeklyDayOff.toString() : "");
        setDaysOff(data.daysOff);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveWeekly(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/delivery/availability", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyDayOff: weeklyDayOff === "" ? null : Number(weeklyDayOff) }),
      });
      setMsg("تم الحفظ بنجاح");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { console.error(e); } finally { setSaving(false); }
  }

  async function addDayOff(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newReason) return;
    setAdding(true);
    try {
      await fetch("/api/delivery/availability/day-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newDate, reason: newReason }),
      });
      setNewDate(""); setNewReason("");
      load();
    } catch (e) { console.error(e); } finally { setAdding(false); }
  }

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-green-600" /></div>;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8 max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Calendar className="h-6 w-6 text-green-600" />
          أوقات العمل والغياب
        </h1>
        <p className="mt-1 text-sm text-gray-500">تحكم في أيام راحتك حتى لا يتم إسناد طلبات لك في هذه الأيام.</p>
      </div>

      {msg && <div className="mb-4 rounded-lg bg-green-50 p-2 text-center text-sm font-bold text-green-700">{msg}</div>}

      {/* يوم الراحة الأسبوعي */}
      <form onSubmit={saveWeekly} className="mb-6 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="mb-4 text-sm font-black">يوم الراحة الأسبوعي</h2>
        <div className="flex gap-3">
          <select value={weeklyDayOff} onChange={(e) => setWeeklyDayOff(e.target.value)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-bold outline-none focus:border-green-500">
            <option value="">بدون يوم راحة ثابت</option>
            {DAYS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
          <button type="submit" disabled={saving} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-700 flex items-center gap-2">
            <Save className="h-4 w-4" /> حفظ
          </button>
        </div>
      </form>

      {/* الغياب الطارئ */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="mb-4 text-sm font-black">تسجيل غياب طارئ (مرض، ظرف...)</h2>
        
        <form onSubmit={addDayOff} className="flex flex-col gap-3 mb-6">
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500" />
          <input type="text" placeholder="سبب الغياب (مثلاً: مريض)" value={newReason} onChange={(e) => setNewReason(e.target.value)} required className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500" />
          <button type="submit" disabled={adding} className="flex items-center justify-center gap-2 rounded-lg bg-gray-900 py-2.5 text-sm font-bold text-white hover:bg-gray-800">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إضافة الغياب
          </button>
        </form>

        <div className="space-y-2">
          {daysOff.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg bg-red-50 p-3 border border-red-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-bold text-red-800">{new Date(d.date).toLocaleDateString("ar-MA")}</span>
              </div>
              <span className="text-xs text-red-600">{d.reason}</span>
            </div>
          ))}
          {daysOff.length === 0 && <p className="text-center text-xs text-gray-400 py-4">لا توجد أيام غياب مسجلة</p>}
        </div>
      </div>
    </div>
  );
}