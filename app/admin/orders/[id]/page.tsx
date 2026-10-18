import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ArrowRight,
  User,
  MapPin,
  Phone,
  Package,
  Store,
  Truck,
  QrCode,
  ScanLine,
  Boxes,
  Gift,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  Truck as TruckIcon,
} from "lucide-react";
import OrderStatusChanger from "@/components/admin/OrderStatusChanger";
import OrderQRViewer from "@/components/admin/OrderQRViewer";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  PROCESSING: "قيد المعالجة",
  SHIPPED: "تم الشحن",
  PARTIALLY_DELIVERED: "تسليم جزئي",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  RETURNED: "مرتجع",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  PENDING: "بانتظار",
  PREPARING: "يُجهَّز",
  READY_FOR_COLLECTION: "جاهز للجمع",
  COLLECTED: "تم الجمع",
  IN_TRANSIT_TO_WAREHOUSE: "في الطريق",
  RECEIVED: "في المستودع",
  VERIFIED: "تم الفحص",
  AVAILABLE_FOR_SHIPMENT: "جاهز للشحن",
  ALLOCATED: "مُخصص",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  RETURNED: "مُرجع",
};

const FULFILLMENT_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  READY_FOR_COLLECTION: "bg-amber-100 text-amber-700",
  COLLECTED: "bg-blue-100 text-blue-700",
  IN_TRANSIT_TO_WAREHOUSE: "bg-indigo-100 text-indigo-700",
  RECEIVED: "bg-teal-100 text-teal-700",
  VERIFIED: "bg-cyan-100 text-cyan-700",
  AVAILABLE_FOR_SHIPMENT: "bg-green-100 text-green-700",
  ALLOCATED: "bg-emerald-100 text-emerald-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-gray-200 text-gray-800",
};

const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  WAITING_FOR_ITEMS: "بانتظار عناصر",
  READY: "جاهزة",
  ASSIGNED: "مُسندة",
  PICKED_UP: "استُلمت",
  OUT_FOR_DELIVERY: "قيد التوصيل",
  IN_TRANSIT: "في النقل",
  DELIVERED: "تم التسليم",
  PARTIALLY_DELIVERED: "تسليم جزئي",
  POSTPONED: "مؤجلة",
  REFUSED: "مرفوضة",
  RETURNED: "مُرجعة",
  CANCELLED: "ملغاة",
};

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orderId = parseInt(id);

  if (isNaN(orderId)) notFound();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          assemblyFile: {
            select: {
              id: true,
              assemblyCode: true,
              status: true,
              receivedItems: true,
              expectedItems: true,
              shippedItems: true,
            },
          },
        },
      },
      seller: {
        select: {
          id: true,
          storeName: true,
          slug: true,
          city: true,
        },
      },
      items: {
        include: {
          fulfillmentItems: {
            select: {
              id: true,
              status: true,
              sellerId: true,
            },
          },
        },
      },
      deliveryPerson: {
        include: {
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      shipmentItems: {
        include: {
          shipment: {
            select: {
              id: true,
              shipmentNumber: true,
              status: true,
              assignedAt: true,
              deliveryPersonId: true,
              deliveryPerson: {
                include: {
                  user: { select: { name: true, phone: true } },
                },
              },
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      returnRequests: {
        select: {
          id: true,
          status: true,
          reason: true,
        },
      },
      couponUsage: {
        select: {
          coupon: { select: { code: true, type: true } },
          discount: true,
        },
      },
    },
  });

  if (!order) notFound();

  const address = order.shippingAddressSnapshot as {
    fullName?: string;
    phone?: string;
    city?: string;
    district?: string;
    street?: string;
    postalCode?: string;
  };

  // ═══ حسم الشحنة الفريدة ═══
  const uniqueShipments = new Map<number, any>();
  for (const si of order.shipmentItems) {
    if (si.shipment && !uniqueShipments.has(si.shipment.id)) {
      uniqueShipments.set(si.shipment.id, si.shipment);
    }
  }
  const shipments = Array.from(uniqueShipments.values());

  // ═══ حساب Fulfillment ═══
  const allFI = order.items.flatMap((i) => i.fulfillmentItems);
  const fulfilledCount = allFI.filter((f) => f.status === "DELIVERED").length;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للطلبات
      </Link>

      {/* ═══ Header ═══ */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-mono text-2xl font-black text-gray-900">
            {order.orderNumber}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{new Date(order.createdAt).toLocaleString("ar-MA")}</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {order.source === "IN_STORE" ? "محل" : "إلكتروني"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <OrderStatusChanger orderId={order.id} currentStatus={order.status} />
        </div>
      </div>

      {/* ═══ Grid ═══ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* ═══ Left column (2/3) ═══ */}
        <div className="space-y-4 lg:col-span-2">
          {/* Products */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <Package className="h-4 w-4 text-[#ff5c00]" />
              المنتجات ({order.items.length})
            </h2>

            <div className="space-y-2">
              {order.items.map((item) => {
                const fi = item.fulfillmentItems[0];
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-100 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-gray-900">
                          {item.productName}
                        </div>
                        {item.variantName && (
                          <div className="mt-0.5 text-[11px] text-gray-500">
                            {item.variantName}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-gray-500">
                          {item.quantity} × {Number(item.unitPrice).toFixed(2)} د.م
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-black text-[#ff5c00]">
                        {Number(item.total).toFixed(2)} د.م
                      </div>
                    </div>
                    {fi && (
                      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                        <span className="text-[10px] text-gray-500">
                          حالة التجهيز
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            FULFILLMENT_COLORS[fi.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {FULFILLMENT_LABELS[fi.status] || fi.status}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-4 space-y-1.5 border-t border-dashed border-gray-200 pt-3 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>المجموع الفرعي</span>
                <span className="font-bold text-gray-900">
                  {Number(order.subtotal).toFixed(2)} د.م
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>الشحن</span>
                <span className="font-bold text-gray-900">
                  {Number(order.shippingCost) === 0
                    ? "مجاني"
                    : `${Number(order.shippingCost).toFixed(2)} د.م`}
                </span>
              </div>
              {Number(order.discount) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>الخصم</span>
                  <span className="font-bold text-green-700">
                    - {Number(order.discount).toFixed(2)} د.م
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
                <span className="font-black">الإجمالي</span>
                <span className="font-black text-[#ff5c00]">
                  {Number(order.total).toFixed(2)} د.م
                </span>
              </div>
            </div>
          </div>

          {/* Shipments */}
          {shipments.length > 0 && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <Truck className="h-4 w-4 text-[#ff5c00]" />
                الشحنات ({shipments.length})
              </h2>

              <div className="space-y-2">
                {shipments.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/shipments/${s.id}`}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-[#ff5c00]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50">
                      <TruckIcon className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs font-black">
                        {s.shipmentNumber}
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        {SHIPMENT_STATUS_LABELS[s.status] || s.status}
                        {s.deliveryPerson?.user?.name && (
                          <> · سائق: {s.deliveryPerson.user.name}</>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Status History */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black">سجل الحالة ({order.statusHistory.length})</h2>
            <div className="space-y-2">
              {order.statusHistory.map((h) => (
                <div
                  key={h.id}
                  className="flex items-start gap-2 rounded-lg border border-gray-100 p-2.5 text-xs"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff5c00]" />
                  <div className="flex-1">
                    <span className="font-bold">
                      {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                    </span>
                    {h.note && (
                      <div className="mt-0.5 text-[10px] text-gray-500">{h.note}</div>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-gray-400">
                    {new Date(h.createdAt).toLocaleString("ar-MA", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ═══ Right column (1/3) ═══ */}
        <div className="space-y-4">
          {/* QR Code */}
          <OrderQRViewer
           deliveryToken={order.deliveryToken}
           orderNumber={order.orderNumber}
          />

          {/* Scan status */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <ScanLine className="h-4 w-4 text-[#ff5c00]" />
              مسح المستودع
            </h2>
            {order.warehouseScannedAt ? (
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  تم المسح
                </div>
                <div className="text-[10px] text-gray-500">
                  {new Date(order.warehouseScannedAt).toLocaleString("ar-MA", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-amber-700">
                <Clock className="h-4 w-4" />
                لم يُمسح بعد
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <User className="h-4 w-4 text-[#ff5c00]" />
              العميل
            </h2>
            <div className="space-y-1 text-xs">
              <div className="font-bold text-gray-900">{order.user.name}</div>
              <div className="text-gray-500">{order.user.email}</div>
              {order.user.phone && (
                <div className="text-gray-500" dir="ltr">
                  {order.user.phone}
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <MapPin className="h-4 w-4 text-[#ff5c00]" />
              عنوان الشحن
            </h2>
            <div className="space-y-1.5 text-xs text-gray-600">
              {address.fullName && (
                <div className="font-bold text-gray-900">{address.fullName}</div>
              )}
              {address.phone && (
                <div className="flex items-center gap-1.5" dir="ltr">
                  <Phone className="h-3 w-3" />
                  {address.phone}
                </div>
              )}
              {address.city && <div>{address.city}</div>}
              {address.district && <div>{address.district}</div>}
              {address.street && <div>{address.street}</div>}
              {address.postalCode && (
                <div className="font-mono text-[10px]">{address.postalCode}</div>
              )}
            </div>
          </div>

          {/* Seller */}
          {order.seller && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <Store className="h-4 w-4 text-[#ff5c00]" />
                التاجر
              </h2>
              <div className="space-y-1 text-xs">
                <Link
                  href={`/admin/sellers/${order.seller.id}`}
                  className="font-bold text-gray-900 hover:text-[#ff5c00]"
                >
                  {order.seller.storeName}
                </Link>
                {order.seller.city && (
                  <div className="text-gray-500">📍 {order.seller.city}</div>
                )}
                <div className="text-[10px] text-gray-400 font-mono">
                  {order.seller.slug}
                </div>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <Receipt className="h-4 w-4 text-[#ff5c00]" />
              الدفع
            </h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">الطريقة</span>
                <span className="font-bold">عند الاستلام</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">الحالة</span>
                <span
                  className={`font-bold ${
                    order.paymentStatus === "PAID"
                      ? "text-green-700"
                      : order.paymentStatus === "REFUNDED"
                        ? "text-red-700"
                        : order.paymentStatus === "PARTIALLY_REFUNDED"
                          ? "text-orange-700"
                          : "text-yellow-700"
                  }`}
                >
                  {order.paymentStatus === "PAID"
                    ? "مدفوع"
                    : order.paymentStatus === "REFUNDED"
                      ? "مسترد"
                      : order.paymentStatus === "PARTIALLY_REFUNDED"
                        ? "مسترد جزئياً"
                        : "في الانتظار"}
                </span>
              </div>
              {Number(order.refundedAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">المسترد</span>
                  <span className="font-bold text-red-700">
                    {Number(order.refundedAmount).toFixed(2)} د.م
                  </span>
                </div>
              )}
              {order.shippingRefunded && (
                <div className="text-[10px] text-green-700">
                  ✅ الشحن مسترد
                </div>
              )}
              {order.couponUsage && (
                <div className="mt-2 rounded-lg bg-green-50 p-2">
                  <div className="text-[10px] text-green-800">
                    🏷️ كوبون: <strong>{order.couponUsage.coupon.code}</strong>
                  </div>
                  <div className="text-[10px] text-green-700">
                    خصم {Number(order.couponUsage.discount).toFixed(2)} د.م
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Loyalty */}
          {(order.loyaltyPointsAwarded > 0 || order.loyaltyPointsRevoked > 0) && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <Gift className="h-4 w-4 text-[#ff5c00]" />
                نقاط الولاء
              </h2>
              <div className="space-y-1 text-xs">
                {order.loyaltyPointsAwarded > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">ممنوحة</span>
                    <span className="font-bold text-green-700">
                      +{order.loyaltyPointsAwarded}
                    </span>
                  </div>
                )}
                {order.loyaltyPointsRevoked > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">مسحوبة</span>
                    <span className="font-bold text-red-700">
                      -{order.loyaltyPointsRevoked}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assembly File */}
          {order.user.assemblyFile && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <Boxes className="h-4 w-4 text-[#ff5c00]" />
                ملف التجميع
              </h2>
              <Link
                href={`/warehouse/assembly/${order.user.assemblyFile.id}`}
                className="block space-y-1 text-xs hover:opacity-80"
              >
                <div className="font-mono font-bold text-teal-700">
                  {order.user.assemblyFile.assemblyCode}
                </div>
                <div className="text-gray-500">
                  {order.user.assemblyFile.receivedItems} /{" "}
                  {order.user.assemblyFile.expectedItems} منتج
                </div>
                <div
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    order.user.assemblyFile.status === "READY"
                      ? "bg-green-100 text-green-700"
                      : order.user.assemblyFile.status === "COMPLETED"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {order.user.assemblyFile.status}
                </div>
              </Link>
            </div>
          )}

          {/* Returns */}
          {order.returnRequests.length > 0 && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
                <XCircle className="h-4 w-4 text-[#ff5c00]" />
                الإرجاعات ({order.returnRequests.length})
              </h2>
              <div className="space-y-1 text-xs">
                {order.returnRequests.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/returns/${r.id}`}
                    className="block rounded-lg bg-gray-50 p-2 hover:bg-gray-100"
                  >
                    <div className="font-bold">{r.status}</div>
                    <div className="text-[10px] text-gray-500">{r.reason}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}