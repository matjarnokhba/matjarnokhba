"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  MapPin,
  Plus,
  Search,
  Store,
  UserCheck,
  Truck,
  ChevronLeft,
  Package,
  X,
} from "lucide-react";

type Zone = {
  id: number;
  code: string;
  name: string;
  type: "COLLECTION" | "DELIVERY";
  city: string;
  districts: string[];
  description: string | null;
  isActive: boolean;
  order: number;
  _count: {
    sellers: number;
    collectors: number;
    deliveryPersons: number;
    shipments: number;
  };
};

export default function AdminZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"ALL" | "COLLECTION" | "DELIVERY">("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // Form
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"COLLECTION" | "DELIVERY">("COLLECTION");
  const [formCity, setFormCity] = useState("");
  const [formDistricts, setFormDistricts] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", typeFilter);
      if (cityFilter !== "ALL") params.set("city", cityFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/zones?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setZones(data.zones || []);
        setCities(data.cities || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, cityFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") load();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleCreate() {
    if (!formCode.trim() || !formName.trim() || !formCity.trim()) return;
    setSubmitting(true);
    setMessage(null);

    try {
      const districts = formDistricts
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);

      const res = await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          type: formType,
          city: formCity.trim(),
          districts,
          description: formDescription.trim() || null,
          order: 0,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإنشاء" });
        return;
      }

      setMessage({ type: "success", text: `✅ تم إنشاء المنطقة ${data.zone.name}` });
      setShowCreate(false);
      setFormCode("");
      setFormName("");
      setFormCity("");
      setFormDistricts("");
      setFormDescription("");
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <MapPin className="h-6 w-6 text-[#ff5c00]" />
            المناطق
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة مناطق الجمع والتوصيل
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          إنشاء منطقة
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Type tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: "ALL", label: "الكل" },
          { key: "COLLECTION", label: "🏪 مناطق الجمع" },
          { key: "DELIVERY", label: "🚚 مناطق التوصيل" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key as any)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              typeFilter === f.key
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برمز المنطقة أو الاسم أو المدينة..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* City filter */}
      {cities.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCityFilter("ALL")}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
              cityFilter === "ALL"
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            🌍 الكل
          </button>
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setCityFilter(c)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                cityFilter === c
                  ? "bg-[#ff5c00] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              📍 {c}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : zones.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <MapPin className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">لا توجد مناطق</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {zones.map((z) => (
            <Link
              key={z.id}
              href={`/admin/zones/${z.id}`}
              className={`block rounded-2xl border-2 bg-white p-4 shadow-sm transition hover:shadow-md ${
                z.isActive ? "border-gray-100" : "border-gray-200 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        z.type === "COLLECTION"
                          ? "bg-teal-100 text-teal-700"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {z.type === "COLLECTION" ? "🏪 جمع" : "🚚 توصيل"}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400">
                      {z.code}
                    </span>
                  </div>
                  <div className="mt-1.5 text-sm font-black">{z.name}</div>
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-500">
                    <MapPin className="h-3 w-3" />
                    {z.city}
                  </div>
                  {z.districts.length > 0 && (
                    <div className="mt-1 text-[10px] text-gray-400">
                      {z.districts.length} حي
                    </div>
                  )}
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
              </div>

              {/* Counts */}
              <div className="mt-3 flex gap-3 border-t border-gray-100 pt-3 text-[10px]">
                {z.type === "COLLECTION" ? (
                  <>
                    <span className="flex items-center gap-1 text-gray-600">
                      <Store className="h-3 w-3" />
                      {z._count.sellers} تاجر
                    </span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <UserCheck className="h-3 w-3" />
                      {z._count.collectors} جامع
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1 text-gray-600">
                      <Truck className="h-3 w-3" />
                      {z._count.deliveryPersons} سائق
                    </span>
                    <span className="flex items-center gap-1 text-gray-600">
                      <Package className="h-3 w-3" />
                      {z._count.shipments} شحنة
                    </span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">إنشاء منطقة</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  النوع
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormType("COLLECTION")}
                    className={`rounded-lg border-2 p-3 text-center transition ${
                      formType === "COLLECTION"
                        ? "border-teal-500 bg-teal-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Store className={`mx-auto h-5 w-5 ${formType === "COLLECTION" ? "text-teal-600" : "text-gray-400"}`} />
                    <div className="mt-1 text-xs font-bold">جمع</div>
                  </button>
                  <button
                    onClick={() => setFormType("DELIVERY")}
                    className={`rounded-lg border-2 p-3 text-center transition ${
                      formType === "DELIVERY"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Truck className={`mx-auto h-5 w-5 ${formType === "DELIVERY" ? "text-indigo-600" : "text-gray-400"}`} />
                    <div className="mt-1 text-xs font-bold">توصيل</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الرمز (للاتنين)
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="مثال: CAS-COL-01"
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الاسم
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: وسط الدار البيضاء"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  المدينة
                </label>
                <input
                  type="text"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="مثال: الدار البيضاء"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الأحياء (مفصولة بفاصلة)
                </label>
                <textarea
                  value={formDistricts}
                  onChange={(e) => setFormDistricts(e.target.value)}
                  rows={2}
                  placeholder="المعاريف، سيدي مومن، الحي الحسني..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الوصف (اختياري)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={
                  submitting ||
                  !formCode.trim() ||
                  !formName.trim() ||
                  !formCity.trim()
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                إنشاء
              </button>
              <button
                onClick={() => setShowCreate(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}