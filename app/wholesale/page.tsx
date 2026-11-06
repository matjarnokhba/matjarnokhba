import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Factory,
  Globe2,
  Briefcase,
  Package,
} from "lucide-react";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";

const TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع",
  SHOP: "محل تجاري",
  BRANCH: "فرع",
  IMPORTER: "مستورد",
  WHOLESALER: "تاجر جملة",
  DISTRIBUTOR: "موزع",
};

const TYPE_ICON = {
  FACTORY: Factory,
  SHOP: Building2,
  BRANCH: Building2,
  IMPORTER: Globe2,
  WHOLESALER: Briefcase,
  DISTRIBUTOR: Package,
} as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "نشط",
  SUSPENDED: "موقوف",
  CLOSED: "مغلق",
};

const STATUS_VARIANT = {
  ACTIVE: "green",
  SUSPENDED: "red",
  CLOSED: "gray",
} as const;

const VERIF_LABEL: Record<string, string> = {
  PENDING: "قيد التحقق",
  VERIFIED: "موثّق",
  REJECTED: "مرفوض",
};

const VERIF_VARIANT = {
  PENDING: "yellow",
  VERIFIED: "green",
  REJECTED: "red",
} as const;

function getCapabilityLabel(cap: string): string {
  switch (cap) {
    case "RETAIL":
      return "بيع بالتجزئة";
    case "WHOLESALE_BUY":
      return "شراء بالجملة";
    case "WHOLESALE_SELL":
      return "بيع بالجملة";
    default:
      return cap;
  }
}

export default async function WholesaleDashboard() {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale");

  const owner = await prisma.businessOwner.findUnique({
    where: { userId: current.user.id },
    select: { id: true, displayName: true },
  });

  const businessUnits = owner
    ? await prisma.businessUnit.findMany({
        where: {
          OR: [
            { ownerId: owner.id },
            {
              members: {
                some: {
                  userId: current.user.id,
                  isActive: true,
                  deletedAt: null,
                },
              },
            },
          ],
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true,
          capabilities: true,
          verificationStatus: true,
          logo: true,
          _count: {
            select: {
              merchantProducts: { where: { deletedAt: null } },
              offers: { where: { deletedAt: null } },
            },
          },
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`أهلاً${current.user.name ? "، " + current.user.name : ""}`}
        description="إدارة أنشطتك التجارية في منظومة الجملة"
        action={
          businessUnits.length > 0 ? (
            <Link href="/wholesale/business-units/new">
              <Button iconLeft={<Plus className="h-4 w-4" />}>
                نشاط تجاري جديد
              </Button>
            </Link>
          ) : undefined
        }
      />

      {businessUnits.length === 0 ? (
        <Empty
          icon={Building2}
          title="لا توجد أنشطة تجارية بعد"
          description="أضف نشاطك التجاري (مصنع، شركة، مستورد، مورد) لتبدأ بعرض منتجاتك للتجار الموثّقين."
          action={
            <Link href="/wholesale/business-units/new">
              <Button size="lg" iconLeft={<Plus className="h-4 w-4" />}>
                إضافة نشاطك التجاري الأول
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businessUnits.map((bu) => {
              const Icon = TYPE_ICON[bu.type as keyof typeof TYPE_ICON] ?? Building2;
              const capabilities = (bu.capabilities as string[]) ?? [];
              return (
                <Link key={bu.id} href={`/wholesale/business-units/${bu.id}`}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
                          <Icon className="h-6 w-6 text-[#ff5c00]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold text-gray-900">
                            {bu.name}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {TYPE_LABEL[bu.type] ?? bu.type}
                          </p>
                        </div>
                      </div>
                      <ArrowLeft className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={
                          STATUS_VARIANT[
                            bu.status as keyof typeof STATUS_VARIANT
                          ] ?? "gray"
                        }
                        dot
                      >
                        {STATUS_LABEL[bu.status] ?? bu.status}
                      </Badge>
                      <Badge
                        variant={
                          VERIF_VARIANT[
                            bu.verificationStatus as keyof typeof VERIF_VARIANT
                          ] ?? "gray"
                        }
                      >
                        {VERIF_LABEL[bu.verificationStatus] ??
                          bu.verificationStatus}
                      </Badge>
                    </div>

                    {capabilities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                          >
                            {getCapabilityLabel(cap)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Package className="h-3.5 w-3.5" />
                        {bu._count.merchantProducts} منتج
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {bu._count.offers} عرض
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          <Card className="border border-dashed border-gray-300 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  هل تدير أكثر من نشاط؟
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  يمكنك إضافة مصنع، شركة، أو محل تجاري تحت نفس الحساب — كل نشاط
                  مستقل بمخزونه وحساباته.
                </p>
              </div>
              <Link href="/wholesale/business-units/new">
                <Button variant="outline" size="sm">
                  إضافة نشاط
                </Button>
              </Link>
            </div>
          </Card>
        </>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold">قيد التطوير</p>
            <p className="mt-1 text-blue-800">
              ميزات العروض، الطلبات، المخزون، والمالية قادمة قريبًا. الأنشطة
              التجارية جاهزة الآن للإنشاء والإدارة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}