"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  ArrowLeft,
  Plus,
  Calendar,
  Building2,
  ShoppingCart,
  Store,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { cn } from "@/lib/ui/cn";
import {
  RETURN_STATUS_LABEL,
  RETURN_STATUS_VARIANT,
  BU_TYPE_LABEL,
  formatDate,
  formatMoney,
  type ReturnListItem,
  type BUOption,
} from "./types";

export interface ReturnsListProps {
  items: ReturnListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  businessUnits: BUOption[];
  currentBUId: string;
  currentDirection: string;
  currentStatus: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "REQUESTED", label: "طلب جديد" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "PENDING_SHIPMENT", label: "بانتظار الشحن" },
  { value: "RECEIVED", label: "تم الاستلام" },
  { value: "INSPECTED", label: "تم الفحص" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "PARTIALLY_ACCEPTED", label: "مقبول جزئيًا" },
  { value: "CANCELLED", label: "ملغى" },
];

export function ReturnsList({
  items,
  pagination,
  businessUnits,
  currentBUId,
  currentDirection,
  currentStatus,
}: ReturnsListProps) {
  const router = useRouter();
  const [buId, setBuId] = useState(currentBUId);
  const [direction, setDirection] = useState(currentDirection || "buyer");
  const [status, setStatus] = useState(currentStatus);

  useEffect(() => {
    setBuId(currentBUId);
    setDirection(currentDirection || "buyer");
    setStatus(currentStatus);
  }, [currentBUId, currentDirection, currentStatus]);

  useEffect(() => {
    if (!buId && businessUnits.length > 0) {
      setBuId(String(businessUnits[0].id));
      const params = new URLSearchParams();
      params.set("businessUnitId", String(businessUnits[0].id));
      params.set("direction", "buyer");
      router.replace(`/wholesale/returns?${params.toString()}`);
    }
  }, [buId, businessUnits, router]);

  const buildUrl = (next: {
    buId?: string;
    direction?: string;
    status?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const b = next.buId ?? buId;
    const d = next.direction ?? direction;
    const s = next.status ?? status;
    const p = next.page ?? 1;
    if (b) params.set("businessUnitId", b);
    if (d) params.set("direction", d);
    if (s) params.set("status", s);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/wholesale/returns?${qs}` : "/wholesale/returns";
  };

  const handleBUChange = (newBUId: string) => {
    setBuId(newBUId);
    router.push(buildUrl({ buId: newBUId, page: 1 }));
  };

  const handleDirectionChange = (newDir: "buyer" | "seller") => {
    setDirection(newDir);
    router.push(buildUrl({ direction: newDir, page: 1 }));
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    router.push(buildUrl({ status: newStatus, page: 1 }));
  };

  const buOptions = businessUnits.map((b) => ({
    value: String(b.id),
    label: `${b.name} (${BU_TYPE_LABEL[b.type] ?? b.type})`,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="المرتجعات"
        description="طلبات الإرجاع التي أرسلتها أو استلمتها"
        action={
          <Link href="/wholesale/returns/new">
            <Button iconLeft={<Plus className="h-4 w-4" />}>
              طلب إرجاع
            </Button>
          </Link>
        }
      />

      {businessUnits.length === 0 ? (
        <Empty
          icon={RotateCcw}
          title="لا توجد أنشطة تجارية"
          description="أنشئ نشاطًا تجاريًا أولًا لإدارة المرتجعات."
          action={
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Card padding="sm">
            <div className="flex flex-col gap-3">
              {/* Direction toggle */}
              <div className="flex gap-2 rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => handleDirectionChange("buyer")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    direction === "buyer"
                      ? "bg-white text-[#ff5c00] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <ShoppingCart className="h-4 w-4" />
                  مرتجعاتي المُرسلة
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionChange("seller")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    direction === "seller"
                      ? "bg-white text-[#ff5c00] shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Store className="h-4 w-4" />
                  مرتجعاتي الواردة
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <Select
                    value={buId}
                    onChange={(e) => handleBUChange(e.target.value)}
                    options={buOptions}
                  />
                </div>
                <div className="sm:w-56">
                  <Select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    options={STATUS_OPTIONS}
                  />
                </div>
              </div>
            </div>
          </Card>

          <div className="text-sm text-gray-500">
            {pagination.total} مرتجع
            {pagination.total > pagination.pageSize && (
              <span className="mr-2">
                (صفحة {pagination.page} من {pagination.totalPages})
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <Empty
              icon={RotateCcw}
              title={
                direction === "buyer"
                  ? "لا توجد مرتجعات مُرسلة"
                  : "لا توجد مرتجعات واردة"
              }
              description={
                direction === "buyer"
                  ? "يمكنك طلب إرجاع من طلب مستلَم — ستجد الزر في صفحة الطلب."
                  : "ستظهر هنا طلبات الإرجاع من التجار المشترين."
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {items.map((item) => {
                  const counterpart =
                    direction === "buyer" ? item.sellerName : item.buyerName;
                  const counterpartLabel =
                    direction === "buyer" ? "البائع" : "المشتري";
                  return (
                    <Link
                      key={item.id}
                      href={`/wholesale/returns/${item.id}`}
                      className="block"
                    >
                      <Card className="transition-shadow hover:shadow-md">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-1 items-start gap-3 min-w-0">
                            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">
                              <RotateCcw className="h-6 w-6 text-gray-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-mono text-xs font-bold text-gray-900">
                                  {item.returnNumber}
                                </p>
                                <Badge
                                  variant={
                                    RETURN_STATUS_VARIANT[item.status] ?? "gray"
                                  }
                                  dot
                                >
                                  {RETURN_STATUS_LABEL[item.status] ??
                                    item.status}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-sm text-gray-700">
                                {item.firstItemName ?? "—"}
                                {item.itemsCount > 1 && (
                                  <span className="text-xs text-gray-500">
                                    {" "}
                                    + {item.itemsCount - 1} منتج آخر
                                  </span>
                                )}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {counterpartLabel}: {counterpart}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(item.createdAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  طلب #{item.originalOrderNumber}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {item.expectedRefundAmount !== null && (
                              <p className="text-lg font-black text-gray-900">
                                {formatMoney(item.expectedRefundAmount)} د.م
                              </p>
                            )}
                            <span className="text-xs text-gray-500">
                              {item.totalQtyRequested} قطعة
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                          <span className="text-gray-500">
                            السبب: {item.reason.slice(0, 60)}
                            {item.reason.length > 60 && "..."}
                          </span>
                          <span className="flex items-center gap-1 font-medium text-[#ff5c00]">
                            عرض التفاصيل
                            <ArrowLeft className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {pagination.totalPages > 1 && (
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(p) => router.push(buildUrl({ page: p }))}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}