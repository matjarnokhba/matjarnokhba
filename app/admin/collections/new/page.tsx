"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Truck,
  MapPin,
  User,
  Package,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type SellerGroup = {
  sellerId: number;
  sellerName: string;
  sellerSlug: string;
  city: string | null;
  region: string | null;
  items: {
    id: number;
    orderId: number;
    orderNumber: string;
    productName: string;
    variantName: string | null;
    sku: string;
    imageUrl: string | null;
    quantity: number;
    readyAt: string | null;
  }[];
};

type DeliveryPerson = {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  vehicleType: string | null;
  activeOrders: number;
};

export default function NewCollectionPage() {
  const router = useRouter();

  const [sellers, setSellers] = useState<SellerGroup[]>([]);
  const [persons, setPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set()
  );
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(
    null
  );
  const [notes, setNotes] = useState("");
  const [expandedSellers, setExpandedSellers] = useState<Set<number>>(
    new Set()
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [itemsRes, personsRes] = await Promise.all([
          fetch("/api/admin/collections/ready"),
          fetch("/api/admin/delivery-persons"),
        ]);

        const itemsData = await itemsRes.json();
        const personsData = await personsRes.json();

        if (!itemsRes.ok || !itemsData.success) {
          setError(itemsData.message || "فشل تحميل العناصر");
          return;
        }
        if (!personsRes.ok || !personsData.success) {
          setError(personsData.message || "فشل تحميل السائقين");
          return;
        }

        setSellers(itemsData.sellers);
        const active = personsData.persons
          .filter((p: any) => p.status === "ACTIVE")
          .sort((a: any, b: any) => a.activeOrders - b.activeOrders);
        setPersons(active);
      } catch {
        setError("فشل الاتصال");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleItem(itemId: number) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleSeller(seller: SellerGroup) {
    const allSelected = seller.items.every((i) =>
      selectedItemIds.has(i.id)
    );
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      for (const item of seller.items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function toggleExpand(sellerId: number) {
    setExpandedSellers((prev) => {
      const next = new Set(prev);
      if (next.has(sellerId)) next.delete(sellerId);
      else next.add(sellerId);
      return next;
    });
  }

  async function handleCreate() {
    if (selectedItemIds.size === 0) {
      setSaveError("اختر عنصراً واحداً على الأقل");
      return;
    }
    if (!selectedPersonId) {
      setSaveError("اختر سائقاً");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const res = await fetch("/api/admin/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryPersonId: selectedPersonId,
          fulfillmentItemIds: Array.from(selectedItemIds),
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveError(data.message || "فشل الإنشاء");
        return;
      }

      router.push("/admin/collections");
    } catch {
      setSaveError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/collections"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للجمع
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-[#ff5c00]" />
          تكليف جمع جديد
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          اختر العناصر الجاهزة وسائقاً ليجمعها
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {sellers.length === 0 && (
        <div className="mb-5 rounded-xl bg-amber-50 p-6 text-center text-sm text-amber-800">
          <Package className="mx-auto mb-2 h-8 w-8" />
          لا توجد عناصر جاهزة للجمع حالياً.
          <br />
          <span className="text-xs">
            يجب أن يعلن التجار جاهزية منتجاتهم أولاً.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {sellers.length > 0 && (
            <>
              <h2 className="text-sm font-black">
                العناصر الجاهزة (
                {sellers.reduce((s, x) => s + x.items.length, 0)})
              </h2>

              {sellers.map((seller) => {
                const allSelected = seller.items.every((i) =>
                  selectedItemIds.has(i.id)
                );
                const someSelected = seller.items.some((i) =>
                  selectedItemIds.has(i.id)
                );
                const isExpanded = expandedSellers.has(seller.sellerId);

                return (
                  <div
                    key={seller.sellerId}
                    className={`rounded-xl bg-white shadow-sm ${
                      someSelected ? "ring-2 ring-[#ff5c00]" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#0a1f44] to-purple-600 text-sm font-black text-white">
                          {seller.sellerName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-black">
                            {seller.sellerName}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                            {seller.city && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" />
                                {seller.city}
                              </span>
                            )}
                            <span>· {seller.items.length} عنصر</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(seller.sellerId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => toggleSeller(seller)}
                          className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                            allSelected
                              ? "bg-[#ff5c00] text-white"
                              : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 p-4">
                        {seller.items.map((item) => {
                          const isSelected = selectedItemIds.has(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleItem(item.id)}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition ${
                                isSelected
                                  ? "border-[#ff5c00] bg-[#fff4ed]/30"
                                  : "border-gray-100 bg-white hover:border-gray-200"
                              }`}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleItem(item.id);
                                }}
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition ${
                                  isSelected
                                    ? "border-[#ff5c00] bg-[#ff5c00] text-white"
                                    : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && (
                                  <Check className="h-4 w-4" />
                                )}
                              </button>

                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  className="h-12 w-12 shrink-0 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-100">
                                  <Package className="h-5 w-5 text-gray-400" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs font-bold">
                                  {item.productName}
                                </div>
                                {item.variantName && (
                                  <div className="text-[10px] text-gray-500">
                                    {item.variantName}
                                  </div>
                                )}
                                <div className="mt-0.5 font-mono text-[9px] text-gray-400">
                                  {item.orderNumber}
                                </div>
                              </div>

                              <div className="shrink-0 text-xs font-black">
                                ×{item.quantity}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black">
                <User className="h-4 w-4 text-[#ff5c00]" />
                السائق
              </h3>

              {persons.length === 0 ? (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  لا يوجد سائقون نشطون
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {persons.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersonId(p.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border-2 p-2.5 text-right transition ${
                        selectedPersonId === p.id
                          ? "border-[#ff5c00] bg-[#fff4ed]"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a1f44] to-purple-600 text-xs font-black text-white">
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold">
                          {p.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {p.city}
                          </span>
                          <span>· {p.activeOrders} مهمة</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black">ملاحظات</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="ملاحظات إضافية..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-black">ملخص</h3>
              <div className="space-y-2 border-b border-dashed border-gray-200 pb-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">العناصر</span>
                  <span className="font-bold">{selectedItemIds.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">التجار</span>
                  <span className="font-bold">
                    {
                      sellers.filter((s) =>
                        s.items.some((i) => selectedItemIds.has(i.id))
                      ).length
                    }
                  </span>
                </div>
              </div>

              {saveError && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {saveError}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={
                  saving ||
                  selectedItemIds.size === 0 ||
                  !selectedPersonId
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                إنشاء التكليف
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}