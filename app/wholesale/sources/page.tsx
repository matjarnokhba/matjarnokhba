"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Plus, Warehouse, Building2, Factory, ShoppingBag, Truck,
  Briefcase, MapPin, Trash2, Edit3, X, CheckCircle2, AlertCircle,
  ArrowLeft,
} from "lucide-react";

type SourceType = "COMPANY" | "WORKSHOP" | "FACTORY" | "WAREHOUSE" | "SHOP" | "DISTRIBUTOR";

type Source = {
  id: number;
  name: string;
  type: SourceType;
  city: string;
  address: string | null;
  isActive: boolean;
  _count: { products: number };
};

const TYPE_OPTIONS: { value: SourceType; label: string; icon: any }[] = [
  { value: "COMPANY", label: "شركة", icon: Building2 },
  { value: "WORKSHOP", label: "ورشة", icon: Briefcase },
  { value: "FACTORY", label: "معمل/مصنع", icon: Factory },
  { value: "WAREHOUSE", label: "مخزن", icon: Warehouse },
  { value: "SHOP", label: "محل", icon: ShoppingBag },
  { value: "DISTRIBUTOR", label: "موزع", icon: Truck },
];

const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.label]));
const TYPE_ICON = Object.fromEntries(TYPE_OPTIONS.map((t) => [t.value, t.icon]));

export default function WholesaleSourcesPage() {
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<SourceType>("WAREHOUSE");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/wholesale/sources");
      if (res.status === 401) {
        router.push("/login?next=/wholesale/sources");
        return;
      }
      const data = await res.json();
      if (data.success) setSources(data.sources || []);
      else setError(data.message);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setName(""); setType("WAREHOUSE"); setCity(""); setAddress("");
    setShowForm(true); setError("");
  }

  function openEdit(s: Source) {
    setEditing(s);
    setName(s.name); setType(s.type); setCity(s.city); setAddress(s.address || "");
    setShowForm(true); setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) { setError("الاسم مطلوب"); return; }
    if (city.trim().length < 2) { setError("المدينة مطلوبة"); return; }

    setSaving(true);
    try {
      const url = editing ? `/api/wholesale/sources/${editing.id}` : "/api/wholesale/sources";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), type, city: city.trim(),
          address: address.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || "فشل الحفظ"); return; }
      setShowForm(false);
      await load();
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("حذف هذا المصدر؟")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/wholesale/sources/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) { alert(data.message || "فشل الحذف"); return; }
      await load();
    } catch {
      alert("خطأ في الاتصال");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(s: Source) {
    setBusyId(s.id);
    try {
      await fetch(`/api/wholesale/sources/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/wholesale/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          عودة للوحة
        </Link>

        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900">المصادر</h1>
            <p className="mt-1 text-sm text-gray-500">
              أضف الشركات، الورشات، المعامل، والمخازن التابعة لك
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة مصدر
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
          </div>
        ) : sources.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm">
            <Warehouse className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              لا توجد مصادر بعد. أضف مصدرك الأول (مخزن، ورشة، شركة...)
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => {
              const Icon = TYPE_ICON[s.type] || Warehouse;
              return (
                <div key={s.id} className={`rounded-xl bg-white p-4 shadow-sm ${!s.isActive ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                        <Icon className="h-5 w-5 text-[#ff5c00]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold">{s.name}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                            {TYPE_LABEL[s.type]}
                          </span>
                          {!s.isActive && (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                              معطّل
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500">
                          <MapPin className="h-3 w-3" />
                          {s.city}
                          {s.address && ` — ${s.address}`}
                          {s._count.products > 0 && (
                            <span className="text-[#ff5c00]">· {s._count.products} منتج</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleActive(s)}
                        disabled={busyId === s.id}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                      >
                        {s.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        onClick={() => openEdit(s)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(s.id)}
                        disabled={busyId === s.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showForm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowForm(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black">
                  {editing ? "تعديل المصدر" : "مصدر جديد"}
                </h2>
                <button onClick={() => setShowForm(false)} className="rounded-full p-1 hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold">نوع المصدر *</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TYPE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const selected = type === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setType(opt.value)}
                          className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-[10px] font-bold transition ${selected ? "border-[#ff5c00] bg-[#fff4ed] text-[#ff5c00]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                        >
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold">اسم المصدر *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: مخزن الدار البيضاء الرئيسي"
                    maxLength={120}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold">المدينة *</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="الدار البيضاء"
                    maxLength={80}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold">العنوان التفصيلي</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="الحي الصناعي، شارع..."
                    maxLength={300}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00]"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {editing ? "حفظ" : "إضافة"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}