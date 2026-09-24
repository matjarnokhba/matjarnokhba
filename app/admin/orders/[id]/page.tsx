import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowRight, User, MapPin, Phone, Package } from "lucide-react";
import OrderStatusChanger from "@/components/admin/OrderStatusChanger";

export const dynamic = "force-dynamic";

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
      user: { select: { name: true, email: true, phone: true } },
      items: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { order: { select: { orderNumber: true } } },
      },
    },
  });

  if (!order) notFound();

  const address = order.shippingAddressSnapshot as {
    fullName?: string;
    phone?: string;
    city?: string;
    street?: string;
    postalCode?: string;
  };

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Breadcrumb ═══ */}
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
          <h1 className="text-2xl font-black text-gray-900">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-xs text-gray-500">
            {new Date(order.createdAt).toLocaleString("ar-MA")}
          </p>
        </div>

        <OrderStatusChanger
          orderId={order.id}
          currentStatus={order.status}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ═══ المنتجات ═══ */}
        <div className="rounded-xl bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Package className="h-4 w-4 text-[#ff5c00]" />
            المنتجات
          </h2>

          <div className="space-y-2">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
              >
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
                    {item.quantity} × {Number(item.unitPrice)} د.م
                  </div>
                </div>
                <div className="shrink-0 text-sm font-black text-[#ff5c00]">
                  {Number(item.total)} د.م
                </div>
              </div>
            ))}
          </div>

          {/* ═══ الإجمالي ═══ */}
          <div className="mt-4 space-y-1.5 border-t border-dashed border-gray-200 pt-3 text-xs">
            <div className="flex justify-between text-gray-500">
              <span>المجموع الفرعي</span>
              <span className="font-bold text-gray-900">
                {Number(order.subtotal)} د.م
              </span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>الشحن</span>
              <span className="font-bold text-gray-900">
                {Number(order.shippingCost) === 0
                  ? "مجاني"
                  : `${Number(order.shippingCost)} د.م`}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
              <span className="font-black">الإجمالي</span>
              <span className="font-black text-[#ff5c00]">
                {Number(order.total)} د.م
              </span>
            </div>
          </div>
        </div>

        {/* ═══ معلومات الشحن + العميل ═══ */}
        <div className="space-y-4">
          {/* العميل */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <User className="h-4 w-4 text-[#ff5c00]" />
              العميل
            </h2>
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-gray-900">{order.user.name}</div>
              <div className="text-gray-500">{order.user.email}</div>
            </div>
          </div>

          {/* العنوان */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <MapPin className="h-4 w-4 text-[#ff5c00]" />
              عنوان الشحن
            </h2>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="font-bold text-gray-900">
                {address.fullName}
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3" />
                {address.phone}
              </div>
              <div>{address.city}</div>
              <div>{address.street}</div>
              {address.postalCode && <div>{address.postalCode}</div>}
            </div>
          </div>

          {/* الدفع */}
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-black">الدفع</h2>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">طريقة الدفع</span>
                <span className="font-bold">عند الاستلام</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">حالة الدفع</span>
                <span className="font-bold text-yellow-600">
                  {order.paymentStatus === "PAID"
                    ? "مدفوع"
                    : order.paymentStatus === "REFUNDED"
                    ? "مسترد"
                    : "في الانتظار"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ سجل الحالة ═══ */}
      <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-black">سجل الحالة</h2>
        <div className="space-y-2">
          {order.statusHistory.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 text-xs"
            >
              <div className="h-2 w-2 shrink-0 rounded-full bg-[#ff5c00]" />
              <div className="flex-1">
                <span className="font-bold">
                  {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                </span>
                {h.note && (
                  <span className="mr-2 text-gray-500">· {h.note}</span>
                )}
              </div>
              <span className="shrink-0 text-gray-400">
                {new Date(h.createdAt).toLocaleString("ar-MA")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}