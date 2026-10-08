"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Search,
  User,
  Package,
  Check,
  Plus,
  Minus,
  Truck,
  AlertCircle,
  Store,
  Globe,
} from "lucide-react";

type OrderItem = {
  id: number;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  shippedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  total: number;
  sellerId: number;
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  source: string;
  total: number;
  createdAt: string;
  seller: { id: number; storeName: string } | null;
  items: OrderItem[];
  hasRemaining: boolean;
};

type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

export default function NewShipmentPage() {
  const router = useRouter();

  // ═══ البحث ═══
  const [searchId, setSearchId] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // ═══ النتائج ═══
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  // ═══ الاختيارات ═══
  const [selectedItems, setSelectedItems] = useState<
    Record<number, number>
  >({}); // orderItemId → quantity

  // ═══ الحفظ ═══
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // ═══ البحث عن العميل ═══
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError("");
    setCustomer(null);
    setOrders([]);
    setSelectedItems({});

    const id = parseInt(searchId.trim());
    if (isNaN(id) || id <= 0) {
      setSearchError("أدخل معرّف عميل صحيح (رقم)");
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}/orders`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSearchError(data.message || "العميل غير موجود");
        return;
      }

      setCustomer(data.customer);
      setOrders(data.orders);

      if (data.orders.length === 0) {
        setSearchError("لا توجد طلبات قابلة للتجميع لهذا العميل");
      }
    } catch {
      setSearchError("فشل الاتصال");
    } finally {
      setSearching(false);
    }
  }

  // ═══ تحديد/إلغاء عنصر ═══
  function toggleItem(item: OrderItem) {
    setSelectedItems((prev) => {
      const copy = { ...prev };
      if (copy[item.id]) {
        delete copy[item.id];
      } else {
        copy[item.id] = item.remainingQuantity;
      }
      return copy;
    });
  }

  // ═══ تغيير كمية ═══
  function setQuantity(item: OrderItem, qty: number) {
    const clamped = Math.max(1, Math.min(qty, item.remainingQuantity));
    setSelectedItems((prev) => ({ ...prev, [item.id]: clamped }));
  }

  // ═══ تحديد كل عناصر طلب ═══
  function toggleAllInOrder(order: Order) {
    const allSelected = order.items.every((i) => selectedItems[i.id]);
    setSelectedItems((prev) => {
      const copy = { ...prev };
      for (const item of order.items) {
        if (allSelected) {
          delete copy[item.id];
        } else {
          copy[item.id] = item.remainingQuantity;
        }
      }
      return copy;
    });
  }

  // ═══ الإجمالي (تقريبي للعرض فقط — السيرفر يحسبه) ═══
  const selectedCount = Object.keys(selectedItems).length;

  const totalCOD = orders.reduce((sum, order) => {
    const orderItemsTotal = order.items.reduce((s, i) => s + i.total, 0);
    let orderCOD = 0;
    for (const item of order.items) {
      const qty = selectedItems[item.id];
      if (!qty) continue;
      const ratio = orderItemsTotal > 0 ? item.total / orderItemsTotal : 0;
      orderCOD += (order.total * ratio * qty) / item.quantity;
    }
    return sum + orderCOD;
  }, 0);

  // ═══ إنشاء الشحنة ═══
  async function handleCreate() {
    if (!customer) return;
    if (selectedCount === 0) {
      setSaveError("اختر عنصراً واحداً على الأقل");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const items = Object.entries(selectedItems).map(([id, qty]) => ({
        orderItemId: parseInt(id),
        quantity: qty,
      }));

      const res = await fetch("/api/admin/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          items,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveError(data.message || "فشل الإنشاء");
        return;
      }

      router.push(`/admin/shipments/${data.shipment.id}`);
    } catch {
      setSaveError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/shipments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للشحنات
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Truck className="h-6 w-6 text-[#ff5c00]" />
          شحنة جديدة
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          اختر عميلاً ثم حدد الطلبات والعناصر
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ═══ اليسار: البحث + الطلبات ═══ */}
        <div className="space-y-4 lg:col-span-2">
          {/* البحث */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-black">البحث عن عميل</h2>

            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="معرّف العميل (مثال: 5)"
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !searchId.trim()}
                className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                بحث
              </button>
            </form>

            {searchError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* معلومات العميل */}
          {customer && (
            <div className="rounded-xl border-2 border-[#ff5c00] bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-black">العميل</h2>
              <div className="space-y-1.5 text-sm">
                <div className="font-black text-gray-900">{customer.name}</div>
                <div className="text-xs text-gray-500">{customer.email}</div>
                {customer.phone && (
                  <div className="text-xs text-gray-500" dir="ltr">
                    📞 {customer.phone}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* قائمة الطلبات */}
          {customer && orders.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-black">
                الطلبات القابلة للتجميع ({orders.length})
              </h2>

              {orders.map((order) => {
                const allSelected = order.items.every(
                  (i) => selectedItems[i.id]
                );
                const someSelected = order.items.some(
                  (i) => selectedItems[i.id]
                );
                const isOnline = order.source === "ONLINE";

                return (
                  <div
                    key={order.id}
                    className={`rounded-xl bg-white p-5 shadow-sm ${
                      someSelected ? "ring-2 ring-[#ff5c00]" : ""
                    }`}
                  >
                    {/* رأس الطلب */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black text-gray-900">
                            {order.orderNumber}
                          </span>
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isOnline
                                ? "bg-blue-50 text-blue-700"
                                : "bg-[#fff4ed] text-[#ff5c00]"
                            }`}
                          >
                            {isOnline ? (
                              <>
                                <Globe className="h-2.5 w-2.5" />
                                إلكتروني
                              </>
                            ) : (
                              <>
                                <Store className="h-2.5 w-2.5" />
                                محل
                              </>
                            )}
                          </span>
                        </div>
                        {order.seller && (
                          <div className="mt-1 text-[10px] text-gray-500">
                            من متجر: {order.seller.storeName}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => toggleAllInOrder(order)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${
                          allSelected
                            ? "bg-[#ff5c00] text-white hover:bg-[#e64a00]"
                            : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {allSelected ? "إلغاء الكل" : "تحديد الكل"}
                      </button>
                    </div>

                    {/* العناصر */}
                    <div className="space-y-2">
                      {order.items.map((item) => {
                        const isSelected = !!selectedItems[item.id];
                        const currentQty = selectedItems[item.id] || 0;

                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border-2 p-3 transition ${
                              isSelected
                                ? "border-[#ff5c00] bg-[#fff4ed]/30"
                                : "border-gray-100 bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleItem(item)}
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 transition ${
                                  isSelected
                                    ? "border-[#ff5c00] bg-[#ff5c00] text-white"
                                    : "border-gray-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="h-4 w-4" />}
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
                                <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] text-gray-500">
                                  <span>
                                    المطلوب: <strong>{item.quantity}</strong>
                                  </span>
                                  {item.shippedQuantity > 0 && (
                                    <span className="text-orange-600">
                                      مشحون: {item.shippedQuantity}
                                    </span>
                                  )}
                                  <span className="text-green-700">
                                    متبقي:{" "}
                                    <strong>{item.remainingQuantity}</strong>
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 text-left">
                                <div className="text-xs font-black text-[#ff5c00]">
                                  {item.unitPrice.toFixed(2)} د.م
                                </div>
                              </div>
                            </div>

                            {/* اختيار الكمية */}
                            {isSelected && (
                              <div className="mt-2 flex items-center justify-between border-t border-dashed border-gray-200 pt-2">
                                <span className="text-[11px] font-bold text-gray-600">
                                  الكمية في الشحنة:
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      setQuantity(item, currentQty - 1)
                                    }
                                    disabled={currentQty <= 1}
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="min-w-[2rem] text-center text-sm font-black">
                                    {currentQty}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setQuantity(item, currentQty + 1)
                                    }
                                    disabled={
                                      currentQty >= item.remainingQuantity
                                    }
                                    className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:opacity-30"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ اليمين: ملخص الشحنة ═══ */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
              <Truck className="h-4 w-4 text-[#ff5c00]" />
              ملخص الشحنة
            </h2>

            <div className="space-y-2 border-b border-dashed border-gray-200 pb-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">العميل</span>
                <span className="font-bold">
                  {customer ? customer.name : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">العناصر المختارة</span>
                <span className="font-bold">{selectedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الطلبات المشمولة</span>
                <span className="font-bold">
                  {new Set(
                    orders
                      .filter((o) =>
                        o.items.some((i) => selectedItems[i.id])
                      )
                      .map((o) => o.id)
                  ).size}
                </span>
              </div>
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-sm font-bold">إجمالي COD</span>
              <div className="text-left">
                <span className="text-xl font-black text-[#ff5c00]">
                  {totalCOD.toFixed(2)}
                </span>
                <span className="mr-1 text-xs text-gray-500">د.م</span>
              </div>
            </div>

            {saveError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={saving || selectedCount === 0 || !customer}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              إنشاء الشحنة
            </button>

            <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
              💡 المبلغ الإجمالي محسوب تقريبياً للعرض. السيرفر يحسب القيم
              النهائية.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}