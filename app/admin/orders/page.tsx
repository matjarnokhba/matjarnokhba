import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Eye,
  ShoppingBag,
  QrCode,
  Truck,
  ScanLine,
  Store,
  Package,
} from "lucide-react";

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

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  PARTIALLY_DELIVERED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-gray-100 text-gray-700",
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

const SHIPMENT_LABELS: Record<string, string> = {
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

const SHIPMENT_COLORS: Record<string, string> = {
  READY: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-indigo-100 text-indigo-700",
  PICKED_UP: "bg-purple-100 text-purple-700",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
  DELIVERED: "bg-green-100 text-green-700",
  POSTPONED: "bg-amber-100 text-amber-700",
  REFUSED: "bg-red-100 text-red-700",
  RETURNED: "bg-gray-100 text-gray-700",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      seller: { select: { storeName: true, slug: true } },
      items: {
        select: {
          id: true,
          fulfillmentItems: { select: { status: true } },
        },
      },
      shipmentItems: {
        take: 1,
        select: {
          shipmentId: true,
          shipment: {
            select: { id: true, shipmentNumber: true, status: true },
          },
        },
      },
    },
  });

  // ═══ Stats ═══
  const stats = {
    total: orders.length,
    active: orders.filter((o) =>
      ["NEW", "PROCESSING", "SHIPPED", "PARTIALLY_DELIVERED"].includes(o.status)
    ).length,
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    cancelled: orders.filter((o) =>
      ["CANCELLED", "RETURNED"].includes(o.status)
    ).length,
  };

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 lg:text-3xl">
          الطلبات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {orders.length} طلب إجمالاً
        </p>
      </div>

      {/* ═══ Stats Cards ═══ */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-black text-gray-900">
            {stats.total}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">الكل</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-black text-blue-600">
            {stats.active}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">نشطة</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-black text-green-600">
            {stats.delivered}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">مُسلَّمة</div>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-black text-red-600">
            {stats.cancelled}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">ملغاة/مرتجعة</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-base font-bold text-gray-700">
            لا توجد طلبات بعد
          </h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500">
                <tr>
                  <th className="px-3 py-3 text-right font-bold">الطلب</th>
                  <th className="px-3 py-3 text-right font-bold">العميل</th>
                  <th className="px-3 py-3 text-right font-bold">التاجر</th>
                  <th className="px-3 py-3 text-right font-bold">الحالة</th>
                  <th className="px-3 py-3 text-right font-bold">التجهيز</th>
                  <th className="px-3 py-3 text-right font-bold">الشحنة</th>
                  <th className="px-3 py-3 text-center font-bold">QR</th>
                  <th className="px-3 py-3 text-center font-bold">مسح</th>
                  <th className="px-3 py-3 text-right font-bold">الإجمالي</th>
                  <th className="px-3 py-3 text-right font-bold">التاريخ</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const shipment = order.shipmentItems[0]?.shipment || null;
                  const allFI = order.items.flatMap((i) => i.fulfillmentItems);
                  const totalFI = allFI.length;
                  const deliveredFI = allFI.filter(
                    (f) => f.status === "DELIVERED"
                  ).length;
                  const pendingFI = allFI.filter(
                    (f) =>
                      !["DELIVERED", "CANCELLED", "RETURNED"].includes(
                        f.status
                      )
                  ).length;

                  const fulfillmentSummary =
                    totalFI === 0
                      ? "—"
                      : deliveredFI === totalFI
                        ? "مكتمل"
                        : `${totalFI - pendingFI}/${totalFI}`;

                  return (
                    <tr
                      key={order.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="whitespace-nowrap px-3 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono text-xs font-black text-gray-900 hover:text-[#ff5c00]"
                        >
                          {order.orderNumber}
                        </Link>
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          {order.items.length} عنصر
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-xs font-bold text-gray-900">
                          {order.user.name}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {order.user.email}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {order.seller ? (
                          <div className="flex items-center gap-1 text-xs font-bold">
                            <Store className="h-3 w-3 text-gray-400" />
                            {order.seller.storeName}
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                            STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span
                          className={`text-[10px] font-bold ${
                            totalFI === 0
                              ? "text-gray-400"
                              : deliveredFI === totalFI
                                ? "text-green-700"
                                : "text-amber-700"
                          }`}
                        >
                          {fulfillmentSummary}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {shipment ? (
                          <Link
                            href={`/admin/shipments/${shipment.id}`}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition hover:opacity-80 ${
                              SHIPMENT_COLORS[shipment.status] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            <Truck className="h-2.5 w-2.5" />
                            {SHIPMENT_LABELS[shipment.status] || shipment.status}
                          </Link>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {order.deliveryToken ? (
                          <span title="QR موجود" className="inline-flex">
                            <QrCode className="h-4 w-4 text-green-600" />
                          </span>
                        ) : (
                          <span className="inline-flex">
                            <QrCode className="h-4 w-4 text-gray-300" />
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {order.warehouseScannedAt ? (
                          <span title="تم المسح في المستودع" className="inline-flex">
                            <ScanLine className="h-4 w-4 text-green-600" />
                          </span>
                        ) : (
                          <span className="inline-flex">
                            <ScanLine className="h-4 w-4 text-gray-300" />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-black text-[#ff5c00]">
                        {Number(order.total).toFixed(2)} د.م
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-[10px] text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#fff4ed] px-2.5 py-1.5 text-[10px] font-bold text-[#ff5c00] transition hover:bg-[#ffe7d5]"
                        >
                          <Eye className="h-3 w-3" />
                          عرض
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}