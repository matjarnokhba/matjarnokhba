import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Package,
  PackageX,
  AlertTriangle,
  Banknote,
  ShoppingCart,
  ArrowLeft,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminMonitorPage() {
  const current = await SessionService.getCurrent();
  if (
    !current ||
    (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/login");
  }

  const [
    pendingHandovers,
    pendingSellerReturns,
    activeLegalNotices,
    escalatedLegalNotices,
    pendingWithdrawals,
    activeShipments,
    totalRevenue,
    pendingRefusedItems,
  ] = await Promise.all([
    prisma.refusedHandoverBatch.count({ where: { status: "PENDING" } }),
    prisma.sellerReturnBatch.count({
      where: { status: { in: ["PENDING", "PICKED_UP"] } },
    }),
    prisma.driverLegalNotice.count({ where: { status: "WARNING" } }),
    prisma.driverLegalNotice.count({ where: { status: "ESCALATED" } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.shipment.count({
      where: {
        status: {
          in: ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"],
        },
      },
    }),
    prisma.wallet.aggregate({
      where: { ownerType: "PLATFORM", ownerId: 1 },
      _sum: { balance: true },
    }),
    prisma.shipmentItem.count({
      where: {
        refusedQuantity: { gt: 0 },
        returnedToWarehouseAt: null,
      },
    }),
  ]);

  const alerts = [];
  if (pendingRefusedItems > 0)
    alerts.push({
      label: "منتجات مرفوضة لم تُستلم",
      value: pendingRefusedItems,
      link: "/warehouse/returns-in-transit",
      color: "amber",
    });
  if (pendingHandovers > 0)
    alerts.push({
      label: "دفعات بانتظار السائق",
      value: pendingHandovers,
      link: "/warehouse/returns-in-transit",
      color: "blue",
    });
  if (pendingSellerReturns > 0)
    alerts.push({
      label: "دفعات للتجار في الطريق",
      value: pendingSellerReturns,
      link: "/warehouse/seller-returns",
      color: "teal",
    });
  if (escalatedLegalNotices > 0)
    alerts.push({
      label: "إنذارات متأخرة - جاهزة للقانوني",
      value: escalatedLegalNotices,
      link: "/admin/legal-notices?filter=ESCALATED",
      color: "red",
    });
  if (activeLegalNotices > 0)
    alerts.push({
      label: "إنذارات قانونية نشطة",
      value: activeLegalNotices,
      link: "/admin/legal-notices?filter=WARNING",
      color: "amber",
    });
  if (pendingWithdrawals > 0)
    alerts.push({
      label: "طلبات سحب بانتظار المراجعة",
      value: pendingWithdrawals,
      link: "/admin/withdrawals",
      color: "purple",
    });

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        رجوع للوحة الإدارة
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          🎛️ لوحة المراقبة المركزية
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          نظرة سريعة على كل شيء يحتاج انتباهك الآن.
        </p>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-6 w-6 opacity-80" />
            <span className="text-xs font-bold opacity-90">أرباح المنصة</span>
          </div>
          <div className="text-3xl font-black">
            {Number(totalRevenue._sum.balance || 0).toFixed(2)}
          </div>
          <div className="text-xs mt-1 opacity-90">د.م صافية</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="h-6 w-6 opacity-80" />
            <span className="text-xs font-bold opacity-90">شحنات نشطة</span>
          </div>
          <div className="text-3xl font-black">{activeShipments}</div>
          <div className="text-xs mt-1 opacity-90">قيد التوصيل</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Banknote className="h-6 w-6 opacity-80" />
            <span className="text-xs font-bold opacity-90">طلبات سحب</span>
          </div>
          <div className="text-3xl font-black">{pendingWithdrawals}</div>
          <div className="text-xs mt-1 opacity-90">بانتظار المراجعة</div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <PackageX className="h-6 w-6 opacity-80" />
            <span className="text-xs font-bold opacity-90">مرتجعات معلّقة</span>
          </div>
          <div className="text-3xl font-black">
            {pendingRefusedItems + pendingHandovers + pendingSellerReturns}
          </div>
          <div className="text-xs mt-1 opacity-90">في كل المراحل</div>
        </div>
      </div>

      {/* ═══ التنبيهات ═══ */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          التنبيهات النشطة ({alerts.length})
        </h2>

        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-5xl mb-2">✅</div>
            <p className="font-bold text-green-700">
              لا توجد تنبيهات - كل شيء تحت السيطرة
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <Link
                key={idx}
                href={alert.link}
                className={`flex items-center justify-between rounded-xl p-4 hover:opacity-90 transition ${
                  alert.color === "red"
                    ? "bg-red-50 border-2 border-red-200"
                    : alert.color === "amber"
                      ? "bg-amber-50 border-2 border-amber-200"
                      : alert.color === "blue"
                        ? "bg-blue-50 border-2 border-blue-200"
                        : alert.color === "teal"
                          ? "bg-teal-50 border-2 border-teal-200"
                          : "bg-purple-50 border-2 border-purple-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      alert.color === "red"
                        ? "bg-red-100 text-red-700"
                        : alert.color === "amber"
                          ? "bg-amber-100 text-amber-700"
                          : alert.color === "blue"
                            ? "bg-blue-100 text-blue-700"
                            : alert.color === "teal"
                              ? "bg-teal-100 text-teal-700"
                              : "bg-purple-100 text-purple-700"
                    }`}
                  >
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{alert.label}</div>
                    <div className="text-xs text-gray-500">
                      اضغط للتفاصيل والإجراء
                    </div>
                  </div>
                </div>
                <div className="text-2xl font-black text-gray-900">
                  {alert.value}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ═══ اختصارات ═══ */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/returns-monitor"
          className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:border-teal-400 transition text-center"
        >
          <PackageX className="h-8 w-8 text-teal-600 mx-auto mb-2" />
          <div className="text-sm font-bold">مراقبة المرتجعات</div>
        </Link>
        <Link
          href="/admin/legal-notices"
          className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:border-red-400 transition text-center"
        >
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <div className="text-sm font-bold">الإنذارات القانونية</div>
        </Link>
        <Link
          href="/admin/withdrawals"
          className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:border-purple-400 transition text-center"
        >
          <Banknote className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <div className="text-sm font-bold">طلبات السحب</div>
        </Link>
        <Link
          href="/admin/orders"
          className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:border-blue-400 transition text-center"
        >
          <ShoppingCart className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-sm font-bold">الطلبات</div>
        </Link>
      </div>
    </div>
  );
}