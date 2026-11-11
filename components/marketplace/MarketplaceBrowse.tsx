"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ShieldCheck,
  ArrowLeft,
  AlertCircle,
  Tag,
  Sparkles,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Check,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Empty } from "@/components/ui/Empty";
import { Pagination } from "@/components/ui/Pagination";
import { BU_TYPE_LABEL, formatMoney } from "@/components/wholesale/offers/types";
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

const SORT_OPTIONS = [
  { value: "", label: "الأحدث" },
  { value: "verified_first", label: "الموثق أولاً" },
  { value: "price_asc", label: "السعر: من الأقل" },
  { value: "price_desc", label: "السعر: من الأعلى" },
  { value: "moq_asc", label: "أقل حد أدنى للطلب" },
];

function SellerInitial({ name }: { name: string }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-[#ff5c00]">
      {letter}
    </div>
  );
}

function OfferCard({ item }: { item: PublicOfferItem }) {
  const priceStr =
    item.minPrice === item.maxPrice
      ? `${formatMoney(item.minPrice)} د.م`
      : `${formatMoney(item.minPrice)} – ${formatMoney(item.maxPrice)} د.م`;

  return (
    <Link href={`/wholesale/marketplace/${item.id}`} className="group block">
      <div className="flex gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white transition-all duration-200 hover:border-[#ff5c00] hover:shadow-lg sm:flex-col sm:gap-0">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden bg-gray-50 sm:h-auto sm:w-full sm:aspect-[4/3]">
          {item.masterImage ? (
            <img
              src={item.masterImage}
              alt={item.masterName}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <Package className="h-8 w-8 sm:h-12 sm:w-12" />
            </div>
          )}
          {item.claimVerified && (
            <div className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-md bg-emerald-600/95 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm sm:right-2 sm:top-2 sm:px-2 sm:py-1 sm:text-[10px]">
              <ShieldCheck className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              موثق
            </div>
          )}
          <div className="absolute bottom-1.5 left-1.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-gray-800 shadow-sm backdrop-blur-sm sm:bottom-2 sm:left-2 sm:px-2 sm:py-1 sm:text-[10px]">
            MOQ: {item.minOrderQty}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5 sm:p-3">
          <div>
            <h3 className="line-clamp-1 text-sm font-bold text-gray-900 sm:line-clamp-2">
              {item.masterName}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-gray-500">
              {item.masterBrand || "بدون علامة"}
            </p>
          </div>

          <div className="mt-1.5">
            <p className="text-[10px] text-gray-500">سعر الجملة</p>
            <p className="text-sm font-black text-[#ff5c00] sm:text-base">
              {priceStr}
            </p>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 border-t border-gray-100 pt-1.5">
            <SellerInitial name={item.sellerName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-gray-700">
                {item.sellerName}
              </p>
              <p className="truncate text-[9px] text-gray-400">
                {BU_TYPE_LABEL[item.sellerType] ?? item.sellerType}
                {item.variantCount > 1 ? ` · ${item.variantCount} خيار` : ""}
              </p>
            </div>
            <ArrowLeft className="h-3.5 w-3.5 flex-shrink-0 text-gray-300 transition group-hover:text-[#ff5c00]" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketplaceBrowse({
  items,
  categories,
  buyerBUs,
  filters: initialFilters,
  pagination,
}: MarketplaceBrowseProps) {
  const router = useRouter();
  const [filters, setFilters] = useState(initialFilters);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [localMin, setLocalMin] = useState(initialFilters.minPrice);
  const [localMax, setLocalMax] = useState(initialFilters.maxPrice);

  useEffect(() => {
    setFilters(initialFilters);
    setLocalMin(initialFilters.minPrice);
    setLocalMax(initialFilters.maxPrice);
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
    if (merged.sort) params.set("sort", merged.sort);
    if ((patch.page ?? 1) > 1) params.set("page", String(patch.page));
    const qs = params.toString();
    return qs ? `/wholesale/marketplace?${qs}` : "/wholesale/marketplace";
  };

  const applyFilter = (patch: Partial<MarketplaceFilters>) => {
    router.push(buildUrl({ ...patch, page: 1 }));
  };

  const clearFilters = () => {
    router.push("/wholesale/marketplace");
    setLocalMin("");
    setLocalMax("");
  };

  const activeFilterCount = [
    filters.categoryId,
    filters.businessType,
    filters.claimVerified,
    filters.minPrice,
    filters.maxPrice,
  ].filter(Boolean).length;

  const hasActiveFilters = filters.search || activeFilterCount > 0;

  if (buyerBUs.length === 0) {
    return (
      <div className="space-y-5" dir="rtl">
        <h1 className="text-2xl font-black text-gray-900">سوق الجملة</h1>
        <Empty
          icon={AlertCircle}
          title="تحتاج نشاطًا تجاريًا مؤهلًا"
          description="للوصول إلى سوق الجملة، يجب أن يكون لديك نشاط تجاري بصلاحية شراء بالجملة."
          action={
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط تجاري</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const filterForm = (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">الفئة</label>
        <Select
          value={filters.categoryId}
          onChange={(e) => applyFilter({ categoryId: e.target.value })}
          options={[
            { value: "", label: "كل الفئات" },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">نوع البائع</label>
        <Select
          value={filters.businessType}
          onChange={(e) => applyFilter({ businessType: e.target.value })}
          options={BUSINESS_TYPE_OPTIONS}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">نطاق السعر (د.م)</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            placeholder="من"
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            className="w-1/2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#ff5c00] focus:outline-none"
          />
          <input
            type="number"
            min="0"
            placeholder="إلى"
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            className="w-1/2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#ff5c00] focus:outline-none"
          />
        </div>
        {(localMin !== filters.minPrice || localMax !== filters.maxPrice) && (
          <button
            type="button"
            onClick={() => applyFilter({ minPrice: localMin, maxPrice: localMax })}
            className="mt-2 w-full rounded-lg bg-[#ff5c00] px-3 py-2 text-xs font-bold text-white hover:bg-[#e64a00]"
          >
            تطبيق النطاق
          </button>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">الترتيب</label>
        <Select
          value={filters.sort}
          onChange={(e) => applyFilter({ sort: e.target.value })}
          options={SORT_OPTIONS}
        />
      </div>

      <button
        type="button"
        onClick={() =>
          applyFilter({ claimVerified: filters.claimVerified === "true" ? "" : "true" })
        }
        className={`flex w-full items-center justify-between rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition ${
          filters.claimVerified === "true"
            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
        }`}
      >
        <span className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          الموثقون فقط
        </span>
        {filters.claimVerified === "true" && <Check className="h-4 w-4" />}
      </button>
    </>
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 sm:text-2xl">سوق الجملة</h1>
          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
            {pagination.total} عرض متاح من المصانع والشركات والموردين
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5 text-xs text-[#ff5c00]">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-bold">{buyerBUs[0].name}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن منتج، علامة تجارية، أو مورد…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyFilter({ search: filters.search });
              }
            }}
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm focus:border-[#ff5c00] focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <button
          type="button"
          onClick={() => applyFilter({ search: filters.search })}
          className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]"
        >
          بحث
        </button>
      </div>

      <div className="hidden sm:block">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">الفئة</label>
              <Select
                value={filters.categoryId}
                onChange={(e) => applyFilter({ categoryId: e.target.value })}
                options={[
                  { value: "", label: "كل الفئات" },
                  ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">نوع البائع</label>
              <Select
                value={filters.businessType}
                onChange={(e) => applyFilter({ businessType: e.target.value })}
                options={BUSINESS_TYPE_OPTIONS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">نطاق السعر</label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  placeholder="من"
                  value={localMin}
                  onChange={(e) => setLocalMin(e.target.value)}
                  onBlur={() => {
                    if (localMin !== filters.minPrice)
                      applyFilter({ minPrice: localMin, maxPrice: localMax });
                  }}
                  className="w-1/2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-[#ff5c00] focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="إلى"
                  value={localMax}
                  onChange={(e) => setLocalMax(e.target.value)}
                  onBlur={() => {
                    if (localMax !== filters.maxPrice)
                      applyFilter({ minPrice: localMin, maxPrice: localMax });
                  }}
                  className="w-1/2 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-[#ff5c00] focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">الترتيب</label>
              <Select
                value={filters.sort}
                onChange={(e) => applyFilter({ sort: e.target.value })}
                options={SORT_OPTIONS}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() =>
                  applyFilter({ claimVerified: filters.claimVerified === "true" ? "" : "true" })
                }
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold transition ${
                  filters.claimVerified === "true"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <Star className="h-3.5 w-3.5" /> موثق
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  مسح
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => setShowMobileFilters(true)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm"
        >
          <span className="flex items-center gap-2 font-medium text-gray-700">
            <SlidersHorizontal className="h-4 w-4" />
            الفلاتر
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-[#ff5c00] px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <ArrowUpDown className="h-3 w-3" />
            {SORT_OPTIONS.find((s) => s.value === filters.sort)?.label ?? "الأحدث"}
          </span>
        </button>
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
          action={
            hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                مسح الفلاتر
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <OfferCard key={item.id} item={item} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={(p) => router.push(buildUrl({ page: p }))}
              />
            </div>
          )}
        </>
      )}

      {showMobileFilters && (
        <div
          className="fixed inset-0 z-50 bg-black/50 sm:hidden"
          onClick={() => setShowMobileFilters(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
              <h3 className="text-base font-bold text-gray-900">الفلاتر</h3>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="rounded-lg p-1.5 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">{filterForm}</div>
            <div className="sticky bottom-0 flex gap-2 border-t border-gray-100 bg-white p-3">
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setShowMobileFilters(false);
                }}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                مسح
              </button>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}