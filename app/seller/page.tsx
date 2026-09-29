import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import {
  Package,
  ShoppingCart,
  Wallet,
  Star,
  TrendingUp,
  Clock,
} from "lucide-react";

export default async function SellerDashboard() {
  const current = await SessionService.getCurrent();
  if (!current?.user.seller) redirect("/login");

  const sellerId = current.user.seller.id;

  // ═══ إحصائيات ═══
  const [
    totalProducts,
    totalOrders,
    pendingOrders,
    totalRevenue,
  ] = await Promise.all([
    prisma.product.count({
      where: { sellerId, deletedAt: null },
    }),
    prisma.order.count({
      where: { sellerId },
    }),
    prisma.order.count({
      where: { sellerId, status: "NEW" },
    }),
    prisma.order.aggregate({
      where: {
        sellerId,
        status: { in: ["DELIVERED", "RETURNED"] },
      },
      _sum: { sellerPayout: true },
    }),
  ]);

  // ═══ آخر الطلبات ═══
  const recentOrders = await prisma.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      customerSnapshot: true,
    },
  });

  const CURRENCY = "د.م";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          مرحباً، {current.user.name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          لوحة تحكم متجر "{current.user.seller.storeName}"
        </p>
      </div>

      {/* ═══ الإحصائيات ═══ */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* المنتجات */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Package className="h-5 w-5 text-[#ff5c00]" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">
              {totalProducts}
            </div>
            <div className="text-xs text-gray-500">منتج في متجرك</div>
          </div>
        </div>

        {/* الطلبات */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">
              {totalOrders}
            </div>
            <div className="text-xs text-gray-500">إجمالي الطلبات</div>
          </div>
        </div>

        {/* قيد المراجعة */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">
              {pendingOrders}
            </div>
            <div className="text-xs text-gray-500">قيد المراجعة</div>
          </div>
        </div>

        {/* الإيرادات */}
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <Wallet className="h-5 w-5 text-green-600" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-gray-900">
              {Number(totalRevenue._sum.sellerPayout || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">أرباحك ({CURRENCY})</div>
          </div>
        </div>
      </div>

      {/* ═══ آخر الطلبات ═══ */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black">آخر الطلبات</h2>
          <a
            href="/seller/orders"
            className="text-xs font-bold text-[#ff5c00] hover:underline"
          >
            عرض الكل ←
          </a>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-4xl">📦</div>
            <p className="mt-2 text-sm text-gray-500">
              لا توجد طلبات بعد
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => {
              const customer = order.customerSnapshot as any;
              return (
                <a
                  key={order.id}
                  href={`/seller/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">
                        {order.orderNumber}
                      </span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {customer?.name || "عميل"}
                    </div>
                  </div>
                  <div className="shrink-0 text-left">
                    <div className="text-sm font-black text-[#ff5c00]">
                      {Number(order.total).toFixed(2)} {CURRENCY}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ Status Badge ═══
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-amber-100 text-amber-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    RETURNED: "bg-gray-100 text-gray-700",
  };
  const labels: Record<string, string> = {
    NEW: "جديد",
    PROCESSING: "قيد التجهيز",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التوصيل",
    CANCELLED: "ملغى",
    RETURNED: "مُرتجع",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${styles[status] || styles.NEW}`}
    >
      {labels[status] || status}
    </span>
  );
}