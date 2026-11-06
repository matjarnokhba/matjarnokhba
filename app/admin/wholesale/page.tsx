import Link from "next/link";
import {
  Package,
  Tag,
  Building2,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

async function getDashboardData() {
  const [
    pendingMasters,
    activeMasters,
    pendingOffers,
    activeOffers,
    pendingBUs,
    verifiedBUs,
    pendingReturns,
    activeOrders,
    topSellers,
  ] = await Promise.all([
    prisma.masterProduct.count({
      where: { status: "PENDING_REVIEW", deletedAt: null },
    }),
    prisma.masterProduct.count({
      where: { status: "ACTIVE", deletedAt: null },
    }),
    prisma.wholesaleOffer.count({
      where: { status: "PENDING_REVIEW", deletedAt: null },
    }),
    prisma.wholesaleOffer.count({
      where: { status: "ACTIVE", deletedAt: null },
    }),
    prisma.businessUnit.count({
      where: { verificationStatus: "PENDING", deletedAt: null, status: "ACTIVE" },
    }),
    prisma.businessUnit.count({
      where: { verificationStatus: "VERIFIED", deletedAt: null },
    }),
    prisma.returnOrder.count({
      where: {
        status: { in: ["REQUESTED", "PENDING_SHIPMENT"] as any },
      },
    }),
    prisma.wholesaleOrder.count({
      where: {
        status: {
          in: ["PENDING", "CONFIRMED", "PROCESSING", "READY", "SHIPPED"] as any,
        },
      },
    }),
    prisma.businessUnit.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        verificationStatus: true,
        createdAt: true,
        _count: {
          select: {
            merchantProducts: { where: { deletedAt: null } },
            offers: { where: { deletedAt: null } },
          },
        },
      },
    }),
  ]);

  return {
    pendingMasters,
    activeMasters,
    pendingOffers,
    activeOffers,
    pendingBUs,
    verifiedBUs,
    pendingReturns,
    activeOrders,
    topSellers,
  };
}

export default async function AdminWholesaleDashboard() {
  const data = await getDashboardData();

  const primaryKpis = [
    {
      label: "منتجات بانتظار المراجعة",
      value: data.pendingMasters,
      href: "/admin/wholesale/master-products?status=PENDING_REVIEW",
      icon: Package,
      urgent: data.pendingMasters > 0,
    },
    {
      label: "عروض بانتظار المراجعة",
      value: data.pendingOffers,
      href: "/admin/wholesale/offers?status=PENDING_REVIEW",
      icon: Tag,
      urgent: data.pendingOffers > 0,
    },
    {
      label: "أنشطة بانتظار التحقق",
      value: data.pendingBUs,
      href: "/admin/wholesale/business-units?verification=PENDING",
      icon: Building2,
      urgent: data.pendingBUs > 0,
    },
    {
      label: "مرتجعات نشطة",
      value: data.pendingReturns,
      href: "/admin/wholesale/returns",
      icon: RotateCcw,
      urgent: data.pendingReturns > 0,
    },
  ];

  const secondaryKpis = [
    {
      label: "منتجات معتمدة",
      value: data.activeMasters,
      icon: CheckCircle2,
      color: "text-emerald-600",
    },
    {
      label: "عروض نشطة",
      value: data.activeOffers,
      icon: Tag,
      color: "text-blue-600",
    },
    {
      label: "أنشطة موثقة",
      value: data.verifiedBUs,
      icon: Building2,
      color: "text-emerald-600",
    },
    {
      label: "طلبات نشطة",
      value: data.activeOrders,
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ];

  const typeLabel: Record<string, string> = {
    FACTORY: "مصنع",
    SHOP: "محل",
    BRANCH: "فرع",
    IMPORTER: "مستورد",
    WHOLESALER: "تاجر جملة",
    DISTRIBUTOR: "موزع",
  };

  const verifLabel: Record<string, string> = {
    PENDING: "قيد التحقق",
    VERIFIED: "موثق",
    REJECTED: "مرفوض",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الجملة"
        description="نظرة عامة على منظومة البيع بالجملة — مراجعة المنتجات، العروض، الأنشطة، والمرتجعات"
      />

      {/* Primary KPIs (actionable) */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-gray-500">
          يحتاج إجراء
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {primaryKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link key={kpi.label} href={kpi.href}>
                <Card
                  className={`h-full transition-shadow hover:shadow-md ${
                    kpi.urgent ? "border-2 border-amber-300" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-500">{kpi.label}</p>
                      <p
                        className={`mt-1 text-3xl font-black ${
                          kpi.urgent ? "text-amber-600" : "text-gray-900"
                        }`}
                      >
                        {kpi.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        kpi.urgent
                          ? "bg-amber-100"
                          : "bg-gray-100"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          kpi.urgent
                            ? "text-amber-600"
                            : "text-gray-500"
                        }`}
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Secondary KPIs (informational) */}
      <div>
        <h3 className="mb-2 text-xs font-medium text-gray-500">
          إجمالي النشاط
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {secondaryKpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">
                      {kpi.value}
                    </p>
                  </div>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent BUs */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-900">
            أحدث الأنشطة التجارية
          </h3>
          <Link
            href="/admin/wholesale/business-units"
            className="text-xs font-medium text-[#ff5c00] hover:underline"
          >
            عرض الكل
          </Link>
        </div>
        {data.topSellers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            لا توجد أنشطة تجارية بعد
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.topSellers.map((bu) => (
              <Link
                key={bu.id}
                href={`/admin/wholesale/business-units/${bu.id}`}
                className="flex items-center justify-between p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {bu.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {typeLabel[bu.type] ?? bu.type}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {bu._count.merchantProducts} منتج · {bu._count.offers} عرض
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    bu.verificationStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-700"
                      : bu.verificationStatus === "PENDING"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {verifLabel[bu.verificationStatus] ?? bu.verificationStatus}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">النظام يعمل تلقائيًا</p>
            <p className="mt-0.5 text-blue-800">
              الأنشطة الموثقة + منتجاتها المعتمدة + عروضها النشطة تظهر تلقائيًا
              في سوق الجملة للتجار.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}