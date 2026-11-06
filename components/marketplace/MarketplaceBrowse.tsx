"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ShieldCheck,
  Building2,
  ArrowLeft,
  AlertCircle,
  Tag,
  Sparkles,
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
  CLAIM_TYPE_LABEL,
  BU_TYPE_LABEL,
  formatDate,
  formatMoney,
} from "@/components/wholesale/offers/types";
import type {
  PublicOfferItem,
  BuyerBU,
  MarketplaceFilters,
} from "./types";

type Category = { id: number; name: string };

export interface MarketplaceBrowseProps {
  items: PublicOfferItem[];
  categories: Category[];
  buyerBUs: BuyerBU[];
  filters: MarketplaceFilters;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const BUSINESS_TYPE_OPTIONS = [
  { value: "", label: "كل الأنواع" },
  { value: "FACTORY", label: "مصنع" },
  { value: "IMPORTER", label: "مستورد" },
  { value: "WHOLESALER", label: "تاجر جملة" },
  { value: "DISTRIBUTOR", label: "موزع" },
  { value: "SHOP", label: "محل" },
];

export function MarketplaceBrowse({
  items,
  categories,
  buyerBUs,
  filters: initialFilters,
  pagination,
}: MarketplaceBrowseProps) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const buildUrl = (patch: Partial<MarketplaceFilters> & { page?: number }) => {
    const merged = { ...filters, ...patch };
    const params = new URLSearchParams();
    if (merged.search.trim()) params.set("search", merged.search.trim());
    if (merged.categoryId) params.set("categoryId", merged.categoryId);
    if (merged.businessType) params.set("businessType", merged.businessType);
    if (merged.claimVerified) params.set("claimVerified", merged.claimVerified);
    if (merged.minPrice) params.set("minPrice", merged.minPrice);
    if (merged.maxPrice) params.set("maxPrice", merged.maxPrice);
    if ((patch.page ?? 1) > 1) params.set("page", String(patch.page));
    const qs = params.toString();
    return qs ? `/wholesale/marketplace?${qs}` : "/wholesale/marketplace";
  };

  const applyFilter = (patch: Partial<MarketplaceFilters>) => {
    router.push(buildUrl({ ...patch, page: 1 }));
  };

  const clearFilters = () => {
    router.push("/wholesale/marketplace");
  };

  const hasActiveFilters =
    filters.search ||
    filters.categoryId ||
    filters.businessType ||
    filters.claimVerified ||
    filters.minPrice ||
    filters.maxPrice;

  // No buyer capability
  if (buyerBUs.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="سوق الجملة"
          description="تصفّح عروض البيع بالجملة من المصانع والشركات والموردين"
        />
        <Empty
          icon={AlertCircle}
          title="تحتاج نشاطًا تجاريًا مؤهلًا"
          description="للوصول إلى سوق الجملة، يجب أن يكون لديك نشاط تجاري بصلاحية شراء بالجملة (WHOLESALE_BUY)."
          action={
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط تجاري</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="سوق الجملة"
        description="تصفّح عروض البيع بالجملة من المصانع والشركات والموردين الموثقين"
        action={
          <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs text-[#ff5c00]">
            <Sparkles className="h-3.5 w-3.5" />
            <span>شراء بنشاط: {buyerBUs[0].name}</span>
          </div>
        }
      />

      {/* Filters */}
      <Card padding="sm">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                البحث
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="اسم المنتج، العلامة، أو البائع"
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyFilter({ search: filters.search });
                    }
                  }}
                  fullWidth
                />
                <Button
                  variant="secondary"
                  onClick={() => applyFilter({ search: filters.search })}
                  iconLeft={<Search className="h-4 w-4" />}
                >
                  بحث
                </Button>
              </div>
            </div>
            <div className="sm:w-48">
              <Select
                label="الفئة"
                value={filters.categoryId}
                onChange={(e) => applyFilter({ categoryId: e.target.value })}
                options={[
                  { value: "", label: "كل الفئات" },
                  ...categories.map((c) => ({
                    value: String(c.id),
                    label: c.name,
                  })),
                ]}
              />
            </div>
            <div className="sm:w-44">
              <Select
                label="نوع البائع"
                value={filters.businessType}
                onChange={(e) =>
                  applyFilter({ businessType: e.target.value })
                }
                options={BUSINESS_TYPE_OPTIONS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="sm:w-44">
              <Select
                label="مطالبة موثقة"
                value={filters.claimVerified}
                onChange={(e) =>
                  applyFilter({ claimVerified: e.target.value })
                }
                options={[
                  { value: "", label: "الكل" },
                  { value: "true", label: "موثقة فقط" },
                  { value: "false", label: "غير موثقة فقط" },
                ]}
              />
            </div>
            <div className="sm:w-36">
              <Input
                label="سعر من (د.م)"
                type="number"
                min="0"
                value={filters.minPrice}
                onChange={(e) =>
                  setFilters({ ...filters, minPrice: e.target.value })
                }
                onBlur={() => applyFilter({ minPrice: filters.minPrice })}
              />
            </div>
            <div className="sm:w-36">
              <Input
                label="إلى (د.م)"
                type="number"
                min="0"
                value={filters.maxPrice}
                onChange={(e) =>
                  setFilters({ ...filters, maxPrice: e.target.value })
                }
                onBlur={() => applyFilter({ maxPrice: filters.maxPrice })}
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="text-sm text-gray-500">
        {pagination.total} عرض
        {pagination.total > pagination.pageSize && (
          <span className="mr-2">
            (صفحة {pagination.page} من {pagination.totalPages})
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <Empty
          icon={Tag}
          title="لا توجد عروض متاحة"
          description={
            hasActiveFilters
              ? "لم يُعثر على عروض بهذه الفلاتر. جرّب مسحها."
              : "لا توجد عروض جملة نشطة حاليًا. تحقق لاحقًا."
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/wholesale/marketplace/${item.id}`}
                className="block"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    {item.masterImage ? (
                      <img
                        src={item.masterImage}
                        alt={item.masterName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-12 w-12 text-gray-300" />
                    )}
                  </div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-900">
                        {item.masterName}
                      </h3>
                      <p className="truncate text-xs text-gray-500">
                        {item.masterBrand || "بدون علامة"}
                      </p>
                    </div>
                    {item.claimVerified && (
                      <ShieldCheck className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                    )}
                  </div>

                  <div className="mb-2 space-y-1 text-xs">
                    <p className="flex items-center gap-1 text-gray-600">
                      <Building2 className="h-3 w-3" />
                      <span className="truncate">{item.sellerName}</span>
                      {item.sellerVerificationStatus === "VERIFIED" && (
                        <Badge variant="green" size="sm">
                          موثق
                        </Badge>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {BU_TYPE_LABEL[item.sellerType] ?? item.sellerType}
                    </p>
                  </div>

                  <div className="mb-2 rounded-lg bg-orange-50 p-2">
                    <p className="text-[10px] text-orange-700">سعر الجملة</p>
                    <p className="text-base font-black text-[#ff5c00]">
                      {item.minPrice === item.maxPrice
                        ? `${formatMoney(item.minPrice)} د.م`
                        : `${formatMoney(item.minPrice)} – ${formatMoney(
                            item.maxPrice
                          )} د.م`}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      الحد الأدنى: {item.minOrderQty} قطعة
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-[11px]">
                    <span className="text-gray-500">
                      {CLAIM_TYPE_LABEL[item.claimType] ?? item.claimType}
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