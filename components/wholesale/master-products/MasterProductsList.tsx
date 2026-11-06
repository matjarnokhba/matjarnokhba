"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Package,
  Search,
  Tag,
  ArrowLeft,
  Barcode,
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
  STATUS_LABEL,
  STATUS_VARIANT,
  formatDate,
  type SerializedListItem,
  type Pagination as PaginationType,
} from "./types";

export interface MasterProductsListProps {
  items: SerializedListItem[];
  pagination: PaginationType;
  currentStatus: string;
  currentSearch: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "PENDING_REVIEW", label: "بانتظار المراجعة" },
  { value: "ACTIVE", label: "نشط" },
  { value: "SUSPENDED", label: "موقوف" },
  { value: "ARCHIVED", label: "مؤرشف" },
];

export function MasterProductsList({
  items,
  pagination,
  currentStatus,
  currentSearch,
}: MasterProductsListProps) {
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
  }): string => {
    const params = new URLSearchParams();
    const s = next.search ?? search;
    const st = next.status ?? status;
    const p = next.page ?? 1;
    if (s.trim()) params.set("search", s.trim());
    if (st) params.set("status", st);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/wholesale/master-products?${qs}` : "/wholesale/master-products";
  };

  const handleFilter = () => {
    router.push(buildUrl({ page: 1 }));
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    router.push(buildUrl({ status: newStatus, page: 1 }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="المنتجات الأصلية"
        description="هويات المنتجات التي رفعتها للاعتماد — يُشاركها كل تجار المنصة، وكل تاجر يحدد سعره ومخزونه."
        action={
          <Link href="/wholesale/master-products/new">
            <Button iconLeft={<Plus className="h-4 w-4" />}>
              إضافة منتج أصلي
            </Button>
          </Link>
        }
      />

      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              البحث
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="بالاسم، العلامة، أو الباركود"
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
          <div className="sm:w-56">
            <Select
              label="الحالة"
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>
      </Card>

      <div className="text-sm text-gray-500">
        {pagination.total} نتيجة
        {pagination.total > pagination.pageSize && (
          <span className="mr-2">
            (صفحة {pagination.page} من {pagination.totalPages})
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <Empty
          icon={Package}
          title="لا توجد منتجات أصلية بعد"
          description="أضف منتجك الأول لتبدأ بعرضه في سوق الجملة للتجار الموثقين."
          action={
            <Link href="/wholesale/master-products/new">
              <Button iconLeft={<Plus className="h-4 w-4" />}>
                إضافة منتج أصلي
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/wholesale/master-products/${item.id}`}
                className="block"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-900">
                        {item.name}
                      </h3>
                      <p className="truncate text-xs text-gray-500">
                        {item.brand || "بدون علامة"}
                      </p>
                    </div>
                    <Badge
                      variant={STATUS_VARIANT[item.status] ?? "gray"}
                      dot
                    >
                      {STATUS_LABEL[item.status] ?? item.status}
                    </Badge>
                  </div>

                  <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    {item.images[0] ? (
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Tag className="h-10 w-10 text-gray-300" />
                    )}
                  </div>

                  <div className="space-y-1 text-xs text-gray-500">
                    <p className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {item.category.name}
                    </p>
                    {item.barcode && (
                      <p className="flex items-center gap-1">
                        <Barcode className="h-3 w-3" />
                        {item.barcode}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                    <span className="text-gray-500">
                      {item.variantCount} متغير · {item.merchantProductCount} تاجر
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      {formatDate(item.createdAt)}
                      <ArrowLeft className="h-3 w-3" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
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