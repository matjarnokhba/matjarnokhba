import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // ═══════ جلب الإحصائيات بالتوازي ═══════
  const [
    productsCount,
    ordersCount,
    usersCount,
    revenueAgg,
    recentOrders,
    lowStockVariants,
  ] = await Promise.all([
    prisma.product.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.order.count(),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.inventory.findMany({
      where: { quantity: { lte: 5 } },
      take: 5,
      include: {
        variant: {
          include: {
            product: { select: { name: true, slug: true } },
          },
        },
      },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.total || 0);

  // ═══════ الإحصائيات ═══════
  const stats = [
    {
      label: "إجمالي الإيرادات",
      value: `${revenue.toLocaleString("ar-MA")} د.م`,
      icon: TrendingUp,
      color: "bg-green-100 text-green-700",
    },
    {
      label: "الطلبات",
      value: ordersCount.toString(),
      icon: ShoppingCart,
      color: "bg-orange-100 text-orange-700",
    },
    {
      label: "المنتجات",
      value: productsCount.toString(),
      icon: Package,
      color: "bg-purple-100 text-purple-700",
    },
    {
      label: "المستخدمون",
      value: usersCount.toString(),
      icon: Users,
      color: "bg-blue-100 text-blue-700",
    },
  ];

  // ═══════ حالات الطلبات ═══════
  const statusLabels: Record<string, string> = {
    NEW: "جديد",
    PROCESSING: "قيد المعالجة",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التسليم",
    CANCELLED: "ملغى",
    RETURNED: "مرتجع",
  };

  const statusColors: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-yellow-100 text-yellow-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    RETURNED: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══════ العنوان ═══════ */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 lg:text-3xl">
          لوحة التحكم
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          نظرة عامة على متجر نخبة
        </p>
      </div>

      {/* ═══════ بطاقات الإحصائيات ═══════ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl bg-white p-4 shadow-sm"
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3">
                <div className="text-xs text-gray-500">{stat.label}</div>
                <div className="mt-1 text-xl font-black text-gray-900 lg:text-2xl">
                  {stat.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════ الطلبات الأخيرة ═══════ */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-black">آخر الطلبات</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 text-xs font-bold text-[#ff5c00] hover:underline"
            >
              عرض الكل
              <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              لا توجد طلبات بعد
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-gray-900">
                        {order.orderNumber}
                      </strong>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          statusColors[order.status]
                        }`}
                      >
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-gray-500">
                      {order.user.name} · {order.user.email}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-black text-[#ff5c00]">
                    {Number(order.total)} د.م
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ═══════ تحذير المخزون ═══════ */}
        <div className="rounded-xl bg-white p-4 shadow-sm lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              مخزون منخفض
            </h2>
            <Link
              href="/admin/products"
              className="flex items-center gap-1 text-xs font-bold text-[#ff5c00] hover:underline"
            >
              عرض الكل
              <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>

          {lowStockVariants.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              كل المنتجات لديها مخزون كافٍ
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockVariants.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-gray-900">
                      {inv.variant.product.name}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {inv.variant.sku}
                    </div>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-black ${
                      inv.quantity === 0
                        ? "bg-red-100 text-red-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {inv.quantity} قطعة
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}