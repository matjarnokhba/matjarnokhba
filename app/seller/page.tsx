import { redirect } from "next/navigation";
import Link from "next/link";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import {
  Package,
  ShoppingCart,
  Wallet,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Users,
  Plus,
  QrCode,
  RotateCcw,
  PackageX,
  FileText,
  Bell,
  ScanLine,
  ArrowLeft,
  Store,
  TrendingUp,
  ListChecks,
  Sparkles,
} from "lucide-react";

const CURRENCY = "د.م";
const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default async function SellerDashboard() {
  const current = await SessionService.getCurrent();
  if (!current?.user.seller) redirect("/login");

  const sellerId = current.user.seller.id;
  const isOwner = current.user.isSellerOwner;

  // ═══ موظف → لوحة مخصصة ═══
  if (!isOwner) {
    return <StaffDashboard current={current} sellerId={sellerId} />;
  }

  // ═══ المالك → اللوحة الكاملة ═══
  return <OwnerDashboard current={current} sellerId={sellerId} />;
}

// ═══════════════════════════════════════════════════════════
// OWNER DASHBOARD (current)
// ═══════════════════════════════════════════════════════════

async function OwnerDashboard({
  current,
  sellerId,
}: {
  current: NonNullable<Awaited<ReturnType<typeof SessionService.getCurrent>>>;
  sellerId: number;
}) {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const fourteenDaysAgo = new Date(sevenDaysAgo);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 7);

  const [
    totalProducts,
    totalOrders,
    newOrders,
    fulfillmentsPending,
    returnsToConfirm,
    batchesToConfirm,
    lowStockCount,
    pendingDocs,
    sellerInfo,
    salesThisWeek,
    salesPrevWeek,
    recentOrders,
  ] = await Promise.all([
    prisma.product.count({ where: { sellerId, deletedAt: null } }),
    prisma.order.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId, status: "NEW" } }),
    prisma.fulfillmentItem.count({
      where: { sellerId, status: { in: ["PENDING", "PREPARING"] } },
    }),
    prisma.returnShipment.count({
      where: {
        status: "IN_TRANSIT_TO_SELLER",
        returnRequest: { order: { sellerId } },
      },
    }),
    prisma.sellerReturnBatch.count({
      where: { sellerId, status: "PICKED_UP" },
    }),
    prisma.inventory.count({
      where: {
        variant: { product: { sellerId, deletedAt: null } },
        quantity: { lt: 5 },
      },
    }),
    prisma.sellerDocument.count({ where: { sellerId, status: "PENDING" } }),
    prisma.seller.findUnique({
      where: { id: sellerId },
      select: {
        walletBalance: true,
        heldBalance: true,
        totalRevenue: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
        status: true,
        storeName: true,
        slug: true,
        isVerified: true,
      },
    }),
    prisma.order.findMany({
      where: {
        sellerId,
        createdAt: { gte: sevenDaysAgo },
        status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
      },
      select: { createdAt: true, total: true },
    }),
    prisma.order.findMany({
      where: {
        sellerId,
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        status: { in: ["DELIVERED", "PARTIALLY_DELIVERED"] },
      },
      select: { total: true },
    }),
    prisma.order.findMany({
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
    }),
  ]);

  const dayBuckets: { date: Date; label: string; value: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    dayBuckets.push({ date: d, label: DAY_LABELS[d.getDay()], value: 0 });
  }
  for (const o of salesThisWeek) {
    const key = o.createdAt.toISOString().slice(0, 10);
    const idx = dayBuckets.findIndex((b) => b.date.toISOString().slice(0, 10) === key);
    if (idx >= 0) dayBuckets[idx].value += Number(o.total);
  }
  const maxSales = Math.max(...dayBuckets.map((b) => b.value), 1);
  const weekTotal = dayBuckets.reduce((s, b) => s + b.value, 0);
  const prevWeekTotal = salesPrevWeek.reduce((s, o) => s + Number(o.total), 0);
  const weekTrend =
    prevWeekTotal > 0
      ? Math.round(((weekTotal - prevWeekTotal) / prevWeekTotal) * 100)
      : weekTotal > 0
        ? 100
        : 0;

  const alerts: { type: "warn" | "danger" | "info"; title: string; href: string }[] = [];
  if (sellerInfo?.status === "PENDING") {
    alerts.push({ type: "info", title: "متجرك بانتظار موافقة الإدارة", href: "/seller/profile" });
  }
  if (newOrders > 0) {
    alerts.push({ type: "warn", title: `${newOrders} طلب جديد يحتاج مراجعة`, href: "/seller/orders" });
  }
  if (returnsToConfirm > 0) {
    alerts.push({ type: "warn", title: `${returnsToConfirm} مرتجع بانتظار تأكيدك`, href: "/seller/returns" });
  }
  if (batchesToConfirm > 0) {
    alerts.push({ type: "warn", title: `${batchesToConfirm} دفعة من المستودع بانتظار الاستلام`, href: "/seller/returns-batches" });
  }
  if (lowStockCount > 0) {
    alerts.push({ type: "danger", title: `${lowStockCount} منتج مخزونه منخفض`, href: "/seller/products" });
  }
  if (pendingDocs > 0) {
    alerts.push({ type: "info", title: `${pendingDocs} وثيقة بانتظار المراجعة`, href: "/seller/documents" });
  }
  if (sellerInfo?.subscriptionStatus === "EXPIRED") {
    alerts.push({ type: "danger", title: "اشتراكك منتهي — جدّد للاستمرار", href: "/seller/subscription" });
  } else if (
    sellerInfo?.subscriptionStatus === "TRIAL" ||
    (sellerInfo?.subscriptionEndsAt &&
      sellerInfo.subscriptionEndsAt.getTime() - now.getTime() < 7 * 86400000)
  ) {
    alerts.push({ type: "warn", title: "اشتراكك ينتهي قريبًا", href: "/seller/subscription" });
  }

  const chartWidth = 100;
  const chartHeight = 40;
  const points = dayBuckets.map((b, i) => {
    const x = (i / 6) * chartWidth;
    const y = chartHeight - (b.value / maxSales) * (chartHeight - 4) - 2;
    return { x, y, value: b.value, label: b.label };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${chartWidth},${chartHeight} L0,${chartHeight} Z`;

  const quickActions = [
    { label: "إضافة منتج", href: "/seller/products/new", icon: Plus, color: "bg-orange-50 text-[#ff5c00]" },
    { label: "طلباتي", href: "/seller/orders", icon: ShoppingCart, color: "bg-blue-50 text-blue-600" },
    { label: "الماسح", href: "/seller/scanner", icon: ScanLine, color: "bg-purple-50 text-purple-600" },
    { label: "QR المتجر", href: "/seller/qr", icon: QrCode, color: "bg-teal-50 text-teal-600" },
    { label: "المحفظة", href: "/seller/wallet", icon: Wallet, color: "bg-green-50 text-green-600" },
    { label: "الموظفون", href: "/seller/staff", icon: Users, color: "bg-indigo-50 text-indigo-600" },
    { label: "الوثائق", href: "/seller/documents", icon: FileText, color: "bg-amber-50 text-amber-600" },
    { label: "الاشتراك", href: "/seller/subscription", icon: Sparkles, color: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">
              مرحبًا، {current.user.name}
            </h1>
            {sellerInfo?.isVerified && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">
                ✓
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
            <Store className="h-3.5 w-3.5" />
            {sellerInfo?.storeName}
            {sellerInfo?.status === "PENDING" && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                بانتظار الموافقة
              </span>
            )}
            {sellerInfo?.status === "ACTIVE" && (
              <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                نشط
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/store/${sellerInfo?.slug}`}
          target="_blank"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
        >
          <Store className="h-3.5 w-3.5" />
          عرض المتجر
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
              <Package className="h-4 w-4 text-[#ff5c00]" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">{totalProducts}</div>
          <div className="text-[11px] text-gray-500">إجمالي المنتجات</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
            {newOrders > 0 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                {newOrders} جديد
              </span>
            )}
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">{totalOrders}</div>
          <div className="text-[11px] text-gray-500">إجمالي الطلبات</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
              <Wallet className="h-4 w-4 text-green-600" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">
            {Number(sellerInfo?.walletBalance || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">الرصيد المتاح ({CURRENCY})</div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-gray-900">
            {Number(sellerInfo?.heldBalance || 0).toFixed(2)}
          </div>
          <div className="text-[11px] text-gray-500">أرباح معلّقة ({CURRENCY})</div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-black text-gray-900">مبيعات آخر 7 أيام</h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-gray-900">
                  {weekTotal.toFixed(2)}
                </span>
                <span className="text-xs text-gray-500">{CURRENCY}</span>
                {weekTrend !== 0 && (
                  <span
                    className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      weekTrend > 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {weekTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(weekTrend)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {weekTotal === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-500">
              لا توجد مبيعات هذا الأسبوع
            </div>
          ) : (
            <>
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                className="h-32 w-full"
              >
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff5c00" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ff5c00" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#salesGrad)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#ff5c00"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="#ff5c00" vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
              <div className="mt-2 flex justify-between text-[10px] text-gray-400">
                {dayBuckets.map((b, i) => (
                  <span key={i}>{b.label}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-[#ff5c00]" />
            <h2 className="text-sm font-black text-gray-900">تنبيهات</h2>
            {alerts.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {alerts.length}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <p className="mt-2 text-xs text-gray-500">كل شيء تحت السيطرة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a, i) => {
                const colors = {
                  danger: "bg-red-50 text-red-700 hover:bg-red-100",
                  warn: "bg-amber-50 text-amber-700 hover:bg-amber-100",
                  info: "bg-blue-50 text-blue-700 hover:bg-blue-100",
                };
                return (
                  <Link
                    key={i}
                    href={a.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-bold transition ${colors[a.type]}`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{a.title}</span>
                    <ArrowLeft className="h-3 w-3" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black text-gray-900">آخر الطلبات</h2>
          <Link href="/seller/orders" className="text-xs font-bold text-[#ff5c00] hover:underline">
            عرض الكل ←
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-4xl">📦</div>
            <p className="mt-2 text-sm text-gray-500">لا توجد طلبات بعد</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentOrders.map((order) => {
              const customer = order.customerSnapshot as { name?: string } | null;
              return (
                <Link
                  key={order.id}
                  href={`/seller/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{order.orderNumber}</span>
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
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <h2 className="mb-3 text-sm font-black text-gray-900">اختصارات سريعة</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 p-3 transition hover:border-[#ff5c00] hover:bg-[#fff4ed]"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-center text-[11px] font-bold text-gray-700">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STAFF DASHBOARD (new — no financials)
// ═══════════════════════════════════════════════════════════

async function StaffDashboard({
  current,
  sellerId,
}: {
  current: NonNullable<Awaited<ReturnType<typeof SessionService.getCurrent>>>;
  sellerId: number;
}) {
  const perms = current.user.staffPermissions;
  const has = (p: string) => perms.includes(p);

  const [
    newOrders,
    fulfillmentsPending,
    returnsToConfirm,
    batchesToConfirm,
    lowStockCount,
    unreadNotifs,
    recentOrders,
  ] = await Promise.all([
    has("VIEW_ORDERS")
      ? prisma.order.count({ where: { sellerId, status: "NEW" } })
      : Promise.resolve(0),
    has("VIEW_FULFILLMENTS")
      ? prisma.fulfillmentItem.count({
          where: { sellerId, status: { in: ["PENDING", "PREPARING"] } },
        })
      : Promise.resolve(0),
    has("VIEW_RETURNS")
      ? prisma.returnShipment.count({
          where: {
            status: "IN_TRANSIT_TO_SELLER",
            returnRequest: { order: { sellerId } },
          },
        })
      : Promise.resolve(0),
    has("VIEW_BATCHES")
      ? prisma.sellerReturnBatch.count({ where: { sellerId, status: "PICKED_UP" } })
      : Promise.resolve(0),
    has("VIEW_PRODUCTS")
      ? prisma.inventory.count({
          where: {
            variant: { product: { sellerId, deletedAt: null } },
            quantity: { lt: 5 },
          },
        })
      : Promise.resolve(0),
    has("VIEW_NOTIFICATIONS")
      ? prisma.notification.count({
          where: { userId: current.user.id, isRead: false },
        })
      : Promise.resolve(0),
    has("VIEW_ORDERS")
      ? prisma.order.findMany({
          where: { sellerId },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
            customerSnapshot: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // ═══ المهام حسب الصلاحيات ═══
  const tasks: { label: string; count: number; href: string; icon: any; color: string }[] = [];
  if (has("VIEW_ORDERS") && newOrders > 0) {
    tasks.push({
      label: `${newOrders} طلب جديد للمراجعة`,
      count: newOrders,
      href: "/seller/orders",
      icon: ShoppingCart,
      color: "bg-blue-100 text-blue-600",
    });
  }
  if (has("MANAGE_FULFILLMENTS") && fulfillmentsPending > 0) {
    tasks.push({
      label: `${fulfillmentsPending} تجهيز قيد الانتظار`,
      count: fulfillmentsPending,
      href: "/seller/fulfillments",
      icon: Package,
      color: "bg-amber-100 text-amber-600",
    });
  }
  if (has("CONFIRM_RETURNS") && returnsToConfirm > 0) {
    tasks.push({
      label: `${returnsToConfirm} مرتجع بانتظار تأكيدك`,
      count: returnsToConfirm,
      href: "/seller/returns",
      icon: RotateCcw,
      color: "bg-rose-100 text-rose-600",
    });
  }
  if (has("CONFIRM_BATCHES") && batchesToConfirm > 0) {
    tasks.push({
      label: `${batchesToConfirm} دفعة بانتظار الاستلام`,
      count: batchesToConfirm,
      href: "/seller/returns-batches",
      icon: PackageX,
      color: "bg-purple-100 text-purple-600",
    });
  }
  if (has("MANAGE_PRODUCTS") && lowStockCount > 0) {
    tasks.push({
      label: `${lowStockCount} منتج مخزونه منخفض`,
      count: lowStockCount,
      href: "/seller/products",
      icon: AlertTriangle,
      color: "bg-red-100 text-red-600",
    });
  }

  // ═══ الاختصارات حسب الصلاحيات ═══
  const quickActions: { label: string; href: string; icon: any; color: string }[] = [];
  if (has("VIEW_ORDERS")) quickActions.push({ label: "طلباتي", href: "/seller/orders", icon: ShoppingCart, color: "bg-blue-50 text-blue-600" });
  if (has("USE_SCANNER")) quickActions.push({ label: "الماسح", href: "/seller/scanner", icon: ScanLine, color: "bg-purple-50 text-purple-600" });
  if (has("VIEW_QR")) quickActions.push({ label: "QR المتجر", href: "/seller/qr", icon: QrCode, color: "bg-teal-50 text-teal-600" });
  if (has("VIEW_FULFILLMENTS")) quickActions.push({ label: "تجهيزاتي", href: "/seller/fulfillments", icon: Package, color: "bg-amber-50 text-amber-600" });
  if (has("VIEW_PRODUCTS")) quickActions.push({ label: "منتجاتي", href: "/seller/products", icon: Package, color: "bg-orange-50 text-[#ff5c00]" });
  if (has("VIEW_RETURNS")) quickActions.push({ label: "المرتجعات", href: "/seller/returns", icon: RotateCcw, color: "bg-rose-50 text-rose-600" });
  if (has("VIEW_BATCHES")) quickActions.push({ label: "الدفعات", href: "/seller/returns-batches", icon: PackageX, color: "bg-indigo-50 text-indigo-600" });
  if (has("VIEW_NOTIFICATIONS")) quickActions.push({ label: "الإشعارات", href: "/seller/notifications", icon: Bell, color: "bg-gray-50 text-gray-600" });

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          مرحبًا، {current.user.name}
        </h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
          <Store className="h-3.5 w-3.5" />
          {current.user.seller?.storeName}
          <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
            موظف
          </span>
        </p>
      </div>

      {/* ═══ Welcome card ═══ */}
      <div className="mb-6 rounded-2xl bg-gradient-to-l from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-indigo-100">
              <Sparkles className="h-4 w-4" />
              لوحة الموظف
            </div>
            <p className="mt-2 text-lg font-black">
              {tasks.length === 0
                ? "لا توجد مهام معلّقة الآن ✨"
                : `لديك ${tasks.reduce((s, t) => s + t.count, 0)} مهمة تحتاج انتباهك`}
            </p>
            <p className="mt-1 text-xs text-indigo-100">
              {new Date().toLocaleDateString("ar-MA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur">
            <ListChecks className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* ═══ Tasks (permission-filtered) ═══ */}
      {tasks.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black text-gray-900">
            <ListChecks className="h-4 w-4 text-[#ff5c00]" />
            مهامك
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {tasks.reduce((s, t) => s + t.count, 0)}
            </span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((t, i) => {
              const Icon = t.icon;
              return (
                <Link
                  key={i}
                  href={t.href}
                  className="flex items-center gap-3 rounded-xl border-2 border-gray-100 bg-white p-4 transition hover:border-[#ff5c00] hover:shadow-md"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${t.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-gray-900">{t.count}</div>
                    <div className="mt-0.5 text-[11px] text-gray-600">{t.label}</div>
                  </div>
                  <ArrowLeft className="h-4 w-4 shrink-0 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Empty state ═══ */}
      {tasks.length === 0 && (
        <div className="mb-6 rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-gray-100">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-3 text-base font-black text-gray-900">كل شيء مكتمل</p>
          <p className="mt-1 text-xs text-gray-500">لا توجد مهام بانتظارك الآن</p>
        </div>
      )}

      {/* ═══ Recent orders (if permission) ═══ */}
      {has("VIEW_ORDERS") && recentOrders.length > 0 && (
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-900">آخر الطلبات</h2>
            <Link href="/seller/orders" className="text-xs font-bold text-[#ff5c00] hover:underline">
              عرض الكل ←
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentOrders.map((order) => {
              const customer = order.customerSnapshot as { name?: string } | null;
              return (
                <Link
                  key={order.id}
                  href={`/seller/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold">{order.orderNumber}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {customer?.name || "عميل"}
                    </div>
                  </div>
                  <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Quick actions (permission-filtered) ═══ */}
      {quickActions.length > 0 && (
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-3 text-sm font-black text-gray-900">اختصاراتك</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-center gap-2 rounded-lg border border-gray-100 p-3 transition hover:border-[#ff5c00] hover:bg-[#fff4ed]"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-center text-[11px] font-bold text-gray-700">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Permission hint ═══ */}
      <div className="mt-4 rounded-lg bg-blue-50 p-3 text-center text-[10px] text-blue-700">
        لإضافة صلاحيات إضافية، تواصل مع صاحب المتجر
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SHARED
// ═══════════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700",
    PROCESSING: "bg-amber-100 text-amber-700",
    SHIPPED: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    PARTIALLY_DELIVERED: "bg-teal-100 text-teal-700",
    CANCELLED: "bg-red-100 text-red-700",
    RETURNED: "bg-gray-100 text-gray-700",
  };
  const labels: Record<string, string> = {
    NEW: "جديد",
    PROCESSING: "قيد التجهيز",
    SHIPPED: "تم الشحن",
    DELIVERED: "تم التوصيل",
    PARTIALLY_DELIVERED: "تسليم جزئي",
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