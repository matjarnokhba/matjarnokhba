"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Package,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  Send,
  Store,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  QrCode,
  ScanLine,
} from "lucide-react";

const CURRENCY = "د.م";

export default function AssemblyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assemblyId = params.id as string;

  const [assembly, setAssembly] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showConfirm, setShowConfirm] = useState<"full" | "partial" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  async function load() {
    try {
      const res = await fetch(`/api/warehouse/assembly/${assemblyId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setAssembly(data.assembly);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (assemblyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assemblyId]);

  // ═══ إعادة تحميل تلقائية عند العودة من scanner ═══
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleOrder(orderId: number) {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  async function handleCreateShipment(allowPartial: boolean) {
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/warehouse/assembly/${assemblyId}/create-shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowPartial }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الإنشاء" });
        return;
      }

      setMessage({
        type: "success",
        text: data.isPartial
          ? `✅ شحنة جزئية ${data.shipmentNumber} — ${data.itemsCount} منتج من ${data.ordersCount} طلب`
          : `✅ شحنة ${data.shipmentNumber} — ${data.itemsCount} منتج من ${data.ordersCount} طلب`,
      });
      setShowConfirm(null);

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

  if (error || !assembly) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-3 text-lg font-black">{error}</h2>
          <Link href="/warehouse/assembly" className="mt-6 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white">
            العودة
          </Link>
        </div>
      </div>
    );
  }

  const address = assembly.shippingAddress || {};
  const orders: any[] = assembly.orders || [];
  const readiness = assembly.readiness || {
    mustScan: [],
    inTransit: [],
    canShipFull: false,
    canShipPartial: false,
  };

  const readyItems = orders
    .filter((o: any) => o.status !== "COMPLETED")
    .flatMap((o: any) => o.items.filter((i: any) => !i.includedInShipment && i.receivedAt));

  const readyOrdersCount = new Set(
    orders
      .filter((o: any) => o.status === "READY")
      .map((o: any) => o.id)
  ).size;

  const isCompleted = assembly.status === "COMPLETED";
  const progress = assembly.expectedItems
    ? Math.round((assembly.receivedItems / assembly.expectedItems) * 100)
    : 0;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/warehouse/assembly"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-teal-600"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للتجميع
      </Link>

      {/* ═══ Header ═══ */}
      <div
        className={`rounded-2xl p-5 text-white shadow-md ${
          isCompleted
            ? "bg-gradient-to-br from-blue-600 to-blue-800"
            : readiness.canShipFull
              ? "bg-gradient-to-br from-green-600 to-green-800"
              : "bg-gradient-to-br from-teal-600 to-teal-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] opacity-90">تجميع للعميل</div>
            <div className="mt-1 text-xl font-black">{assembly.user.name}</div>
            {assembly.user.phone && (
              <div className="mt-1 flex items-center gap-1.5 text-xs opacity-90" dir="ltr">
                <Phone className="h-3 w-3" />
                {assembly.user.phone}
              </div>
            )}
            <div className="mt-1 text-[11px] opacity-75 font-mono">
              {assembly.assemblyCode}
            </div>
          </div>
          <div className="rounded-xl bg-white/20 p-3">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span>
              {orders.length} طلب · {assembly.receivedItems}/{assembly.expectedItems} منتج
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ═══ عنوان العميل ═══ */}
      {address.city && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-black">
            <MapPin className="h-4 w-4 text-teal-600" />
            عنوان التوصيل
          </h2>
          <div className="text-xs leading-relaxed text-gray-700">
            {address.fullName && <div className="font-bold">{address.fullName}</div>}
            {address.phone && <div className="text-gray-500" dir="ltr">{address.phone}</div>}
            <div className="mt-1">{[address.street, address.buildingNumber].filter(Boolean).join("، ")}</div>
            <div>{[address.district, address.city].filter(Boolean).join("، ")}</div>
            {address.postalCode && <div className="font-mono text-gray-500">{address.postalCode}</div>}
          </div>
        </div>
      )}

      {/* ═══ حالة المسح ═══ */}
      {!isCompleted && (
        <div className="mt-4 rounded-2xl border-2 border-teal-200 bg-teal-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-teal-700" />
            <h2 className="text-sm font-black text-teal-900">مسح QR الطلبيات</h2>
          </div>

          {readiness.mustScan.length > 0 ? (
            <div className="mb-3 rounded-lg bg-amber-100 p-3 text-xs text-amber-900">
              ⚠️ <strong>{readiness.mustScan.length} طلب</strong> في المستودع لم يمسح بعد
            </div>
          ) : readiness.inTransit.length > 0 ? (
            <div className="mb-3 rounded-lg bg-blue-100 p-3 text-xs text-blue-900">
              🚚 <strong>{readiness.inTransit.length} طلب</strong> في الطريق — يمكنك انتظارها أو الشحن الجزئي
            </div>
          ) : (
            <div className="mb-3 rounded-lg bg-green-100 p-3 text-xs font-bold text-green-900">
              ✅ كل الطلبات في المستودع تم مسحها
            </div>
          )}

          <Link
            href={`/warehouse/assembly/${assemblyId}/scan`}
            className="flex items-center justify-center gap-2 rounded-xl bg-teal-600 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700"
          >
            <QrCode className="h-5 w-5" />
            فتح الماسح
          </Link>
        </div>
      )}

      {/* ═══ الطلبات ═══ */}
      <div className="mt-4 space-y-2">
        <h2 className="px-1 text-sm font-black text-gray-700">
          الطلبات ({orders.length})
        </h2>
        {orders.map((order: any) => {
          const expanded = expandedOrders.has(order.id);
          const scanned = !!order.warehouseScannedAt;
          const readyItemsInOrder = order.items.filter((i: any) => !i.includedInShipment && i.receivedAt);
          const orderRevenue = readyItemsInOrder.reduce((s: number, i: any) => s + i.total, 0);

          return (
            <div key={order.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <button
                onClick={() => toggleOrder(order.id)}
                className="flex w-full items-center gap-3 p-3 text-right transition hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black">{order.orderNumber}</span>
                    <OrderStatusBadge status={order.status} />
                    {scanned ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        ✓ ممسوح
                      </span>
                    ) : order.status !== "COMPLETED" && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        لم يمسح
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {order.items.length} منتج
                    {readyItemsInOrder.length > 0 && (
                      <span className="mr-1 font-bold text-green-700">
                        · {readyItemsInOrder.length} جاهز ({orderRevenue.toFixed(2)} {CURRENCY})
                      </span>
                    )}
                  </div>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>

              {expanded && (
                <div className="border-t border-gray-100 p-3">
                  <div className="space-y-2">
                    {order.items.map((item: any) => (
                      <div key={item.assemblyItemId} className="flex gap-2 rounded-lg bg-gray-50 p-2">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} className="h-12 w-12 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-200">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-1 text-xs font-bold">{item.productName}</div>
                          {item.variantName && <div className="text-[10px] text-gray-500">{item.variantName}</div>}
                          {item.seller && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                              <Store className="h-2.5 w-2.5" />
                              {item.seller.storeName}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] font-black">×{item.quantity}</div>
                          <div className="text-[10px] text-gray-500">{item.total.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ الشحنات ═══ */}
      {assembly.shipments?.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Truck className="h-4 w-4 text-teal-600" />
            الشحنات ({assembly.shipments.length})
          </h2>
          <div className="space-y-2">
            {assembly.shipments.map((s: any) => (
              <Link
                key={s.id}
                href={`/warehouse/shipments/${s.id}`}
                className="block rounded-lg border border-gray-100 p-2.5 transition hover:border-teal-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs font-black">{s.shipmentNumber}</span>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {s._count.items} منتج · {s.totalOrders} طلب
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Actions ═══ */}
      {!isCompleted && readyItems.length > 0 && (
        <div className="mt-4 space-y-2">
          {readiness.canShipFull && (
            <button
              onClick={() => setShowConfirm("full")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-green-700"
            >
              <Send className="h-5 w-5" />
              إنشاء شحنة كاملة — {readyOrdersCount} طلب ({readyItems.length} منتج)
            </button>
          )}

          {readiness.canShipPartial && readiness.inTransit.length > 0 && (
            <button
              onClick={() => setShowConfirm("partial")}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-4 text-sm font-bold text-white shadow-md transition hover:bg-orange-700"
            >
              <AlertTriangle className="h-5 w-5" />
              شحن جزئي — بدون {readiness.inTransit.length} طلب في الطريق
            </button>
          )}

          {readiness.mustScan.length > 0 && (
            <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-center text-xs text-amber-900">
              ⚠️ امسح QR كل طلب في المستودع قبل إنشاء الشحنة
            </div>
          )}
        </div>
      )}

      {isCompleted && (
        <div className="mt-4 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-blue-600" />
          <div className="mt-2 text-sm font-black text-blue-900">✅ تم شحن كل الطلبات</div>
        </div>
      )}

      {/* ═══ Confirm Modal ═══ */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {showConfirm === "full" ? "تأكيد إنشاء الشحنة" : "تأكيد الشحن الجزئي"}
              </h3>
              <button
                onClick={() => setShowConfirm(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {showConfirm === "partial" && (
              <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                سيتم الشحن بدون <strong>{readiness.inTransit.length} طلب</strong> في الطريق. ستبقى للشحنة القادمة.
              </div>
            )}

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-teal-50 p-2">
                <div className="text-xl font-black text-teal-900">{readyOrdersCount}</div>
                <div className="mt-0.5 text-[10px] text-teal-700">طلبات</div>
              </div>
              <div className="rounded-xl bg-green-50 p-2">
                <div className="text-xl font-black text-green-900">{readyItems.length}</div>
                <div className="mt-0.5 text-[10px] text-green-700">منتجات</div>
              </div>
              <div className="rounded-xl bg-blue-50 p-2">
                <div className="text-xl font-black text-blue-900">
                  {readyItems.reduce((s: number, i: any) => s + i.total, 0).toFixed(0)}
                </div>
                <div className="mt-0.5 text-[10px] text-blue-700">{CURRENCY}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCreateShipment(showConfirm === "partial")}
                disabled={creating}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${
                  showConfirm === "full" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                تأكيد
              </button>
              <button
                onClick={() => setShowConfirm(null)}
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

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    READY: { label: "✅ جاهز", cls: "bg-green-100 text-green-700" },
    PARTIAL: { label: "🔀 جزئي", cls: "bg-orange-100 text-orange-700" },
    PENDING: { label: "⏳ بانتظار", cls: "bg-amber-100 text-amber-700" },
    COMPLETED: { label: "📦 مكتمل", cls: "bg-blue-100 text-blue-700" },
  };
  const info = map[status] || { label: status, cls: "bg-gray-100 text-gray-700" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${info.cls}`}>{info.label}</span>;
}