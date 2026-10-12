"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Package,
  MapPin,
  Store,
  User,
  Phone,
  Truck,
  Check,
  X,
  CheckSquare,
  Square,
  Search,
  Plus,
} from "lucide-react";

const CURRENCY = "د.م";

type ReadyGroup = {
  groupKey: string;
  orderId: number;
  orderNumber: string;
  city: string | null;
  district: string | null;
  street: string | null;
  customerName: string;
  customerPhone: string | null;
  itemsCount: number;
  fulfillmentItemIds: number[];
  products: Array<{
    id: number;
    name: string;
    imageUrl: string | null;
    quantity: number;
  }>;
  seller: { storeName: string; city: string | null };
};

type CityInfo = {
  city: string;
  count: number;
  totalItems: number;
  totalFulfillmentItems: number;
};

export default function WarehouseReadyPage() {
  const router = useRouter();

  const [ready, setReady] = useState<ReadyGroup[]>([]);
  const [cities, setCities] = useState<CityInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/warehouse/ready-for-shipment");
      const data = await res.json();
      if (data.success) {
        setReady(data.ready || []);
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
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [cityFilter, search]);

  const filtered = useMemo(() => {
    let list = [...ready];

    if (cityFilter !== "ALL") {
      list = list.filter((r) => (r.city || "غير محدد") === cityFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.orderNumber.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.seller.storeName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [ready, cityFilter, search]);

  const selectedGroups = useMemo(
    () => filtered.filter((r) => selectedIds.has(r.orderId)),
    [filtered, selectedIds]
  );

  const selectedFulfillmentCount = useMemo(
    () => selectedGroups.reduce((s, g) => s + g.fulfillmentItemIds.length, 0),
    [selectedGroups]
  );

  const selectedItemsCount = useMemo(
    () => selectedGroups.reduce((s, g) => s + g.itemsCount, 0),
    [selectedGroups]
  );

  function toggleSelect(orderId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map((r) => r.orderId)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleCreate() {
    if (selectedFulfillmentCount === 0) return;

    setCreating(true);
    setMessage(null);

    try {
      const allIds = selectedGroups.flatMap((g) => g.fulfillmentItemIds);

      const res = await fetch("/api/warehouse/shipments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fulfillmentItemIds: allIds,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({
          type: "error",
          text: data.message || "فشل إنشاء الشحنة",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `✅ تم إنشاء الشحنة ${data.shipmentNumber} — ${data.itemsCount} عنصر`,
      });

      setShowCreateModal(false);
      setNotes("");
      setSelectedIds(new Set());
      await load();

      setTimeout(() => {
        router.push(`/warehouse/shipments/${data.shipmentId}`);
      }, 1500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Truck className="h-6 w-6 text-teal-600" />
          جاهز للشحن
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {ready.length} طلب · {cities.length} مدينة — اختر لإنشاء شحنة
        </p>
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

      {ready.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Truck className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            لا توجد عناصر جاهزة للشحن
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCityFilter("ALL")}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                cityFilter === "ALL"
                  ? "bg-teal-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              🌍 الكل ({ready.length})
            </button>
            {cities.map((c) => (
              <button
                key={c.city}
                onClick={() => setCityFilter(c.city)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
                  cityFilter === c.city
                    ? "bg-teal-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                📍 {c.city} ({c.count})
              </button>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث برقم الطلب أو اسم العميل أو التاجر..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-xs outline-none focus:border-teal-500"
              />
            </div>
            <button
              onClick={
                selectedIds.size === filtered.length ? clearSelection : selectAll
              }
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
            >
              {selectedIds.size === filtered.length ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selectedIds.size === filtered.length ? "إلغاء" : "الكل"}
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-teal-300 bg-teal-50 p-4">
              <div className="flex-1">
                <div className="text-xs font-black text-teal-900">
                  ✓ {selectedGroups.length} طلب · {selectedItemsCount} منتج
                </div>
                <div className="mt-0.5 text-[10px] text-teal-700">
                  {selectedFulfillmentCount} عنصر سيكون في الشحنة
                </div>
              </div>
              <button
                onClick={clearSelection}
                className="rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-bold text-teal-700 hover:bg-teal-50"
              >
                إلغاء
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
              >
                <Plus className="h-3.5 w-3.5" />
                إنشاء شحنة
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <Search className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">لا نتائج مطابقة</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((g) => {
                const isSelected = selectedIds.has(g.orderId);

                return (
                  <div
                    key={g.groupKey}
                    className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition ${
                      isSelected
                        ? "border-teal-500"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex gap-3">
                      <button
                        onClick={() => toggleSelect(g.orderId)}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-teal-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-black">
                            {g.orderNumber}
                          </span>
                          <Link
                            href={`/warehouse/orders/${g.orderId}`}
                            className="text-[10px] font-bold text-teal-600 underline hover:text-teal-800"
                          >
                            عرض التفاصيل
                          </Link>
                        </div>

                        <div className="mt-2 space-y-1 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-gray-400" />
                            <span className="font-bold">{g.customerName}</span>
                          </div>
                          {g.customerPhone && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{g.customerPhone}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-1.5 text-gray-600">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>
                              {g.city}
                              {g.district && ` — ${g.district}`}
                              {g.street && ` — ${g.street}`}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500">
                          <Store className="h-3 w-3" />
                          <span>{g.seller.storeName}</span>
                          {g.seller.city && (
                            <>
                              <span>·</span>
                              <span>{g.seller.city}</span>
                            </>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {g.products.slice(0, 5).map((p, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 text-[10px]"
                            >
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="h-5 w-5 rounded object-cover"
                                />
                              ) : (
                                <Package className="h-3 w-3 text-gray-400" />
                              )}
                              <span className="max-w-[100px] truncate">
                                {p.name}
                              </span>
                              <span className="font-bold">×{p.quantity}</span>
                            </div>
                          ))}
                          {g.products.length > 5 && (
                            <div className="rounded-lg bg-gray-50 px-2 py-1 text-[10px] text-gray-500">
                              +{g.products.length - 5}
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="rounded-full bg-teal-50 px-2 py-0.5 font-bold text-teal-700">
                            {g.itemsCount} منتج
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-600">
                            {g.fulfillmentItemIds.length} عنصر
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">تأكيد إنشاء الشحنة</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-teal-50 p-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-2xl font-black text-teal-900">
                    {selectedGroups.length}
                  </div>
                  <div className="mt-1 text-[10px] text-teal-700">طلبات</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-teal-900">
                    {selectedItemsCount}
                  </div>
                  <div className="mt-1 text-[10px] text-teal-700">منتجات</div>
                </div>
              </div>
            </div>

            {selectedGroups.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-xs font-bold text-gray-700">
                  المدن المُحددة
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    new Set(selectedGroups.map((g) => g.city || "غير محدد"))
                  ).map((city) => (
                    <span
                      key={city}
                      className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700"
                    >
                      📍 {city}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1 block text-xs font-bold text-gray-700">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:bg-white"
                placeholder="مثال: تسليم قبل الساعة 6..."
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                إنشاء الشحنة
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
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