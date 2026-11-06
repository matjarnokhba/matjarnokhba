"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  RotateCcw,
  ExternalLink,
  Building2,
  Calendar,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import {
  RETURN_STATUS_LABEL,
  RETURN_STATUS_VARIANT,
  formatDate,
  formatMoney,
} from "@/components/wholesale/returns/types";

type ReturnAdminItem = {
  id: number;
  returnNumber: string;
  originalOrderId: number;
  originalOrderNumber: string;
  buyerBusinessUnitId: number;
  sellerBusinessUnitId: number;
  buyerName: string;
  sellerName: string;
  status: string;
  reason: string;
  expectedRefundAmount: number | null;
  approvedRefundAmount: number | null;
  itemsCount: number;
  totalQtyRequested: number;
  totalQtyAccepted: number;
  firstItemName: string | null;
  createdAt: string;
  completedAt: string | null;
};

export interface ReturnsAdminListProps {
  items: ReturnAdminItem[];
  statusCounts: Record<string, number>;
  currentStatus: string;
  currentSearch: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function ReturnsAdminList({
  items,
  statusCounts,
  currentStatus,
  currentSearch,
  pagination,
}: ReturnsAdminListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);

  useEffect(() => {
    setSearch(currentSearch);
    setStatus(currentStatus);
  }, [currentSearch, currentStatus]);

  const buildUrl = (next: {
    search?: string;
    status?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const s = next.search ?? search;
    const st = next.status ?? status;
    const p = next.page ?? 1;
    if (s.trim()) params.set("search", s.trim());
    if (st && st !== "ALL") params.set("status", st);
    else if (st === "ALL") params.set("status", st);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs
      ? `/admin/wholesale/returns?${qs}`
      : "/admin/wholesale/returns";
  };

  const handleFilter = () => router.push(buildUrl({ page: 1 }));

  const statusOptions = [
    { value: "ALL", label: `الكل (${statusCounts.ALL ?? 0})` },
    {
      value: "REQUESTED",
      label: `طلب جديد (${statusCounts.REQUESTED ?? 0})`,
    },
    {
      value: "APPROVED",
      label: `معتمد (${statusCounts.APPROVED ?? 0})`,
    },
    {
      value: "PENDING_SHIPMENT",
      label: `بانتظار الشحن (${statusCounts.PENDING_SHIPMENT ?? 0})`,
    },
    {
      value: "RECEIVED",
      label: `تم الاستلام (${statusCounts.RECEIVED ?? 0})`,
    },
    {
      value: "INSPECTED",
      label: `تم الفحص (${statusCounts.INSPECTED ?? 0})`,
    },
    {
      value: "PARTIALLY_ACCEPTED",
      label: `مقبول جزئيًا (${statusCounts.PARTIALLY_ACCEPTED ?? 0})`,
    },
    {
      value: "COMPLETED",
      label: `مكتمل (${statusCounts.COMPLETED ?? 0})`,
    },
    {
      value: "REJECTED",
      label: `مرفوض (${statusCounts.REJECTED ?? 0})`,
    },
    {
      value: "CANCELLED",
      label: `ملغى (${statusCounts.CANCELLED ?? 0})`,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المرتجعات — مراقبة"
        description="عرض جميع المرتجعات بين التجار (للمراقبة فقط — لا تُنفّذ إجراءات)"
      />

      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              البحث برقم المرتجع
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="WR-2026-..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleFilter();
                  }
                }}
                fullWidth
              />
              <Button
                variant="secondary"
                onClick={handleFilter}
                iconLeft={<Search className="h-4 w-4" />}
              >
                بحث
              </Button>
            </div>
          </div>
          <div className="sm:w-72">
            <Select
              label="الحالة"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                router.push(buildUrl({ status: e.target.value, page: 1 }));
              }}
              options={statusOptions}
            />
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
          title="لا توجد مرتجعات"
          description="لم يُعثر على مرتجعات بهذه الحالة."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                    <th className="px-3 py-3">المرتجع</th>
                    <th className="px-3 py-3">الطلب</th>
                    <th className="px-3 py-3">الأطراف</th>
                    <th className="px-3 py-3">المنتج</th>
                    <th className="px-3 py-3">الكميات</th>
                    <th className="px-3 py-3">الحالة</th>
                    <th className="px-3 py-3">المبلغ</th>
                    <th className="px-3 py-3">التاريخ</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs font-bold text-gray-900">
                          {item.returnNumber}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/wholesale/orders/${item.originalOrderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-[#ff5c00] hover:underline"
                        >
                          {item.originalOrderNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-[11px] space-y-0.5">
                          <p className="flex items-center gap-1 text-gray-700">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            <span className="font-medium">بائع:</span>{" "}
                            <span className="truncate">{item.sellerName}</span>
                          </p>
                          <p className="flex items-center gap-1 text-gray-700">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            <span className="font-medium">مشتري:</span>{" "}
                            <span className="truncate">{item.buyerName}</span>
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-gray-900">
                          {item.firstItemName ?? "—"}
                        </p>
                        {item.itemsCount > 1 && (
                          <p className="text-[10px] text-gray-500">
                            + {item.itemsCount - 1} منتج آخر
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-gray-700">
                        <p>مطلوب: {item.totalQtyRequested}</p>
                        <p className="text-emerald-700">
                          مقبول: {item.totalQtyAccepted}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={RETURN_STATUS_VARIANT[item.status] ?? "gray"}
                          dot
                        >
                          {RETURN_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {item.approvedRefundAmount !== null ? (
                          <p className="font-bold text-emerald-700">
                            {formatMoney(item.approvedRefundAmount)}
                          </p>
                        ) : item.expectedRefundAmount !== null ? (
                          <p className="text-gray-500">
                            ~{formatMoney(item.expectedRefundAmount)}
                          </p>
                        ) : (
                          <p className="text-gray-400">—</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-gray-500">
                        <p className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(item.createdAt)}
                        </p>
                        {item.completedAt && (
                          <p className="mt-0.5 text-emerald-600">
                            ✓ {formatDate(item.completedAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/wholesale/returns/${item.id}`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#ff5c00]"
                          aria-label="عرض"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}