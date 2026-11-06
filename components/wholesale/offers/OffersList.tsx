"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Tag,
  Search,
  ArrowLeft,
  Package,
  ShieldCheck,
  TrendingUp,
  Eye,
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
  OFFER_STATUS_LABEL,
  OFFER_STATUS_VARIANT,
  CLAIM_TYPE_LABEL,
  BU_TYPE_LABEL,
  formatDate,
  type OfferListItem,
  type BUOption,
} from "./types";

export interface OffersListProps {
  items: OfferListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  businessUnits: BUOption[];
  currentStatus: string;
  currentBUId: string;
  currentSearch: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "DRAFT", label: "مسودة" },
  { value: "PENDING_REVIEW", label: "بانتظار المراجعة" },
  { value: "ACTIVE", label: "نشط" },
  { value: "PAUSED", label: "موقوف مؤقتًا" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "SUSPENDED", label: "موقوف إداريًا" },
  { value: "ARCHIVED", label: "مؤرشف" },
];

export function OffersList({
  items,
  pagination,
  businessUnits,
  currentStatus,
  currentBUId,
  currentSearch,
}: OffersListProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  const [buId, setBuId] = useState(currentBUId);

  useEffect(() => {
    setSearch(currentSearch);
    setStatus(currentStatus);
    setBuId(currentBUId);
  }, [currentSearch, currentStatus, currentBUId]);

  const buildUrl = (next: {
    search?: string;
    status?: string;
    businessUnitId?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const s = next.search ?? search;
    const st = next.status ?? status;
    const bu = next.businessUnitId ?? buId;
    const p = next.page ?? 1;
    if (s.trim()) params.set("search", s.trim());
    if (st) params.set("status", st);
    if (bu) params.set("businessUnitId", bu);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/wholesale/offers?${qs}` : "/wholesale/offers";
  };

  const handleFilter = () => router.push(buildUrl({ page: 1 }));

  const buOptions = [
    { value: "", label: "كل الأنشطة" },
    ...businessUnits.map((b) => ({
      value: String(b.id),
      label: `${b.name} (${BU_TYPE_LABEL[b.type] ?? b.type})`,
    })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="عروض الجملة"
        description="عروضك للبيع بالجملة للتجار الموثقين — كل عرض مرتبط بمنتج أصلي معتمد."
        action={
          businessUnits.length > 0 ? (
            <Link href="/wholesale/offers/new">
              <Button iconLeft={<Plus className="h-4 w-4" />}>
                عرض جديد
              </Button>
            </Link>
          ) : undefined
        }
      />

      {businessUnits.length === 0 ? (
        <Empty
          icon={Tag}
          title="أنشئ نشاطًا تجاريًا أولًا"
          description="قبل عرض منتجاتك بالجملة، تحتاج نشاطًا تجاريًا بصلاحية البيع بالجملة."
          action={
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Card padding="sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  البحث
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="بالمنتج أو النشاط"
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
              <div className="lg:w-56">
                <Select
                  label="النشاط"
                  value={buId}
                  onChange={(e) => {
                    setBuId(e.target.value);
                    router.push(buildUrl({ businessUnitId: e.target.value, page: 1 }));
                  }}
                  options={buOptions}
                />
              </div>
              <div className="lg:w-48">
                <Select
                  label="الحالة"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    router.push(buildUrl({ status: e.target.value, page: 1 }));
                  }}
                  options={STATUS_OPTIONS}
                />
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
              title="لا توجد عروض"
              description="ابدأ بإنشاء عرض جملة لمنتج أصلي معتمد."
              action={
                <Link href="/wholesale/offers/new">
                  <Button iconLeft={<Plus className="h-4 w-4" />}>
                    عرض جديد
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
                    href={`/wholesale/offers/${item.id}`}
                    className="block"
                  >
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="truncate text-sm font-bold text-gray-900">
                            {item.masterName}
                          </h3>
                          <p className="truncate text-xs text-gray-500">
                            {item.masterBrand || "بدون علامة"}
                          </p>
                        </div>
                        <Badge
                          variant={OFFER_STATUS_VARIANT[item.status] ?? "gray"}
                          dot
                        >
                          {OFFER_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </div>

                      <div className="mb-3 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                        {item.masterImage ? (
                          <img
                            src={item.masterImage}
                            alt={item.masterName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-10 w-10 text-gray-300" />
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <p className="flex items-center justify-between">
                          <span className="text-gray-500">سعر الجملة</span>
                          <span className="font-bold text-gray-900">
                            {item.wholesalePrice} د.م
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="text-gray-500">الحد الأدنى</span>
                          <span className="text-gray-700">
                            {item.minOrderQty} قطعة
                          </span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span className="text-gray-500">نوع المطالبة</span>
                          <span className="text-gray-700">
                            {CLAIM_TYPE_LABEL[item.claimType] ?? item.claimType}
                            {item.claimVerified && (
                              <ShieldCheck className="mr-1 inline h-3 w-3 text-emerald-600" />
                            )}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                        <span className="flex items-center gap-1 text-gray-500">
                          <Tag className="h-3 w-3" />
                          {item.variantCount} متغير · {item.businessUnitName}
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
        </>
      )}
    </div>
  );
}