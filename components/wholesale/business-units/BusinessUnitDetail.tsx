"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Tag,
  ShoppingCart,
  Warehouse,
  CheckCircle2,
  XCircle,
  Building2,
  Users,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/ui/cn";
import { MembersTab } from "./MembersTab";
import { SettingsTab } from "./SettingsTab";
import {
  TYPE_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  VERIF_LABEL,
  VERIF_VARIANT,
  getCapLabel,
  type SerializableBusinessUnit,
  type SerializableMember,
  type BUStats,
} from "./types";

type Tab = "overview" | "members" | "settings";

export interface BusinessUnitDetailProps {
  businessUnit: SerializableBusinessUnit;
  isOwner: boolean;
  currentUserId: number;
  stats: BUStats;
  initialMembers: SerializableMember[];
}

export function BusinessUnitDetail({
  businessUnit,
  isOwner,
  currentUserId,
  stats,
  initialMembers,
}: BusinessUnitDetailProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const [members, setMembers] =
    useState<SerializableMember[]>(initialMembers);

  const tabs: Array<{ key: Tab; label: string; icon: typeof Users }> = [
    { key: "overview", label: "نظرة عامة", icon: Building2 },
    { key: "members", label: "الأعضاء", icon: Users },
    ...(isOwner
      ? ([{ key: "settings", label: "الإعدادات", icon: Settings }] as const)
      : []),
  ];

  const statCards = [
    {
      label: "المنتجات",
      value: stats.productCount,
      icon: Package,
      color: "bg-orange-100 text-[#ff5c00]",
    },
    {
      label: "عروض الجملة",
      value: stats.offerCount,
      icon: Tag,
      color: "bg-blue-100 text-blue-600",
    },
    {
      label: "الطلبات",
      value: stats.orderCount,
      icon: ShoppingCart,
      color: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "المخزون الكلي",
      value: stats.inventoryOnHand,
      icon: Warehouse,
      color: "bg-purple-100 text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/wholesale"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة لكل الأنشطة
      </Link>

      <PageHeader
        title={businessUnit.name}
        description={
          TYPE_LABEL[businessUnit.type] +
          " · " +
          (businessUnit.description || "لا يوجد وصف")
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                STATUS_VARIANT[businessUnit.status] ?? "gray"
              }
              dot
            >
              {STATUS_LABEL[businessUnit.status] ?? businessUnit.status}
            </Badge>
            <Badge
              variant={
                VERIF_VARIANT[businessUnit.verificationStatus] ?? "gray"
              }
            >
              {businessUnit.verificationStatus === "VERIFIED" && (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {businessUnit.verificationStatus === "REJECTED" && (
                <XCircle className="h-3 w-3" />
              )}
              {VERIF_LABEL[businessUnit.verificationStatus] ??
                businessUnit.verificationStatus}
            </Badge>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-[#ff5c00] text-[#ff5c00]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <Card key={s.label}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className="mt-1 text-2xl font-black text-gray-900">
                        {s.value}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg",
                        s.color
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              صلاحيات النشاط
            </h3>
            {businessUnit.capabilities.length === 0 ? (
              <p className="text-sm text-gray-500">لا توجد صلاحيات محددة</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {businessUnit.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700"
                  >
                    {getCapLabel(cap)}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link href={`/wholesale/offers?businessUnitId=${businessUnit.id}`}>
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                    <Tag className="h-5 w-5 text-[#ff5c00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">عروض الجملة</p>
                    <p className="text-xs text-gray-500">
                      {stats.offerCount} عرض · عرض منتجاتك للتجار
                    </p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-gray-400" />
                </div>
              </Card>
            </Link>
            <Link href="/wholesale/offers/new">
              <Card className="cursor-pointer border-2 border-dashed border-gray-300 transition-colors hover:border-[#ff5c00]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <Package className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">إضافة عرض جديد</p>
                    <p className="text-xs text-gray-500">
                      اعرض منتجًا أصليًا للبيع بالجملة
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          {businessUnit.verificationStatus === "PENDING" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">الحساب قيد التحقق</p>
              <p className="mt-1">
                يمكنك البدء بإضافة المنتجات والعروض. سيراجع فريقنا حسابك
                قريبًا لتوثيقه.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "members" && (
        <MembersTab
          businessUnitId={businessUnit.id}
          isOwner={isOwner}
          currentUserId={currentUserId}
          members={members}
          onMembersChange={setMembers}
        />
      )}

      {tab === "settings" && isOwner && (
        <SettingsTab businessUnit={businessUnit} />
      )}
    </div>
  );
}