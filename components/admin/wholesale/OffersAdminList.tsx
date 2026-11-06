"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Tag,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ShieldX,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/lib/hooks/useToast";
import {
  OFFER_STATUS_LABEL,
  OFFER_STATUS_VARIANT,
  CLAIM_TYPE_LABEL,
  BU_TYPE_LABEL,
  formatDate,
  formatMoney,
} from "@/components/wholesale/offers/types";

type AdminOfferItem = {
  id: number;
  masterId: number;
  masterName: string;
  masterBrand: string | null;
  masterImage: string | null;
  masterBarcode: string | null;
  businessUnitId: number;
  businessUnitName: string;
  businessUnitType: string;
  businessUnitVerification: string;
  wholesalePrice: number;
  minPrice: number;
  maxPrice: number;
  minOrderQty: number;
  status: string;
  claimType: string;
  claimVerified: boolean;
  reviewLevel: string;
  variantCount: number;
  createdAt: string;
};

export interface OffersAdminListProps {
  items: AdminOfferItem[];
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

type ActionKey = "approve" | "reject" | "suspend" | "restore";

export function OffersAdminList({
  items,
  statusCounts,
  currentStatus,
  currentSearch,
  pagination,
}: OffersAdminListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    item: AdminOfferItem;
    action: "reject" | "suspend";
  } | null>(null);
  const [reason, setReason] = useState("");

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
    if (st) params.set("status", st);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs
      ? `/admin/wholesale/offers?${qs}`
      : "/admin/wholesale/offers";
  };

  const handleFilter = () => router.push(buildUrl({ page: 1 }));

  const execute = async (
    item: AdminOfferItem,
    action: ActionKey,
    body: Record<string, any> = {}
  ) => {
    setActionLoading(`${action}-${item.id}`);
    try {
      const res = await fetch(
        `/api/admin/wholesale/offers/${item.id}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل تنفيذ العملية", "error");
        return;
      }
      toast("تم تنفيذ العملية بنجاح", "success");
      setDialog(null);
      setReason("");
      router.refresh();
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDialogConfirm = () => {
    if (!dialog) return;
    if (reason.trim().length < 3) {
      toast("السبب يجب أن يكون 3 أحرف على الأقل", "warning");
      return;
    }
    execute(dialog.item, dialog.action, { reason: reason.trim() });
  };

  const statusOptions = [
    {
      value: "PENDING_REVIEW",
      label: `بانتظار المراجعة (${statusCounts.PENDING_REVIEW ?? 0})`,
    },
    { value: "ACTIVE", label: `نشط (${statusCounts.ACTIVE ?? 0})` },
    {
      value: "PAUSED",
      label: `موقوف مؤقتًا (${statusCounts.PAUSED ?? 0})`,
    },
    {
      value: "SUSPENDED",
      label: `موقوف إداريًا (${statusCounts.SUSPENDED ?? 0})`,
    },
    {
      value: "REJECTED",
      label: `مرفوض (${statusCounts.REJECTED ?? 0})`,
    },
    { value: "ALL", label: "الكل" },
  ];

  const actionButtons = (item: AdminOfferItem) => {
    const buttons = [];
    if (item.status === "PENDING_REVIEW" || item.status === "REJECTED") {
      buttons.push(
        <Button
          key="approve"
          size="sm"
          variant="success"
          loading={actionLoading === `approve-${item.id}`}
          onClick={() => execute(item, "approve")}
          iconLeft={<CheckCircle2 className="h-3.5 w-3.5" />}
        >
          اعتماد
        </Button>
      );
    }
    if (item.status === "PENDING_REVIEW") {
      buttons.push(
        <Button
          key="reject"
          size="sm"
          variant="danger"
          onClick={() => {
            setDialog({ item, action: "reject" });
            setReason("");
          }}
          iconLeft={<XCircle className="h-3.5 w-3.5" />}
        >
          رفض
        </Button>
      );
    }
    if (item.status === "ACTIVE") {
      buttons.push(
        <Button
          key="suspend"
          size="sm"
          variant="outline"
          onClick={() => {
            setDialog({ item, action: "suspend" });
            setReason("");
          }}
          iconLeft={<ShieldX className="h-3.5 w-3.5" />}
        >
          إيقاف إداريًا
        </Button>
      );
    }
    if (item.status === "SUSPENDED" || item.status === "REJECTED") {
      buttons.push(
        <Button
          key="restore"
          size="sm"
          variant="primary"
          loading={actionLoading === `restore-${item.id}`}
          onClick={() => execute(item, "restore")}
          iconLeft={<RotateCcw className="h-3.5 w-3.5" />}
        >
          استعادة
        </Button>
      );
    }
    return buttons;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="عروض الجملة — مراجعة"
        description="مراجعة واعتماد عروض البيع بالجملة من التجار"
      />

      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
          <div className="sm:w-64">
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
        {pagination.total} نتيجة
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
          description="لم يُعثر على عروض بهذه الحالة."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                    <th className="px-3 py-3">المنتج</th>
                    <th className="px-3 py-3">النشاط</th>
                    <th className="px-3 py-3">السعر</th>
                    <th className="px-3 py-3">المطالبة</th>
                    <th className="px-3 py-3">الحالة</th>
                    <th className="px-3 py-3">التاريخ</th>
                    <th className="px-3 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
                            {item.masterImage ? (
                              <img
                                src={item.masterImage}
                                alt={item.masterName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Tag className="h-4 w-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {item.masterName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.masterBrand || "بدون علامة"}
                              {item.masterBarcode &&
                                ` · ${item.masterBarcode}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 text-xs">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.businessUnitName}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              {BU_TYPE_LABEL[item.businessUnitType] ??
                                item.businessUnitType}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-bold text-gray-900">
                          {formatMoney(item.minPrice)} د.م
                        </p>
                        {item.maxPrice > item.minPrice && (
                          <p className="text-[10px] text-gray-500">
                            إلى {formatMoney(item.maxPrice)} د.م
                          </p>
                        )}
                        <p className="text-[10px] text-gray-500">
                          {item.variantCount} متغير
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            item.claimVerified ? "green" : "yellow"
                          }
                          size="sm"
                        >
                          {item.claimVerified && (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          {CLAIM_TYPE_LABEL[item.claimType] ?? item.claimType}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={OFFER_STATUS_VARIANT[item.status] ?? "gray"}
                          dot
                        >
                          {OFFER_STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {actionButtons(item)}
                          <Link
                            href={`/wholesale/offers/${item.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#ff5c00]"
                            aria-label="عرض"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
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

      <Dialog
        open={!!dialog}
        onClose={() => {
          setDialog(null);
          setReason("");
        }}
        title={dialog?.action === "reject" ? "رفض العرض" : "إيقاف العرض إداريًا"}
        description={
          dialog?.item
            ? `سيتم ${dialog.action === "reject" ? "رفض" : "إيقاف"} عرض "${dialog.item.masterName}" من ${dialog.item.businessUnitName}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialog(null);
                setReason("");
              }}
              disabled={!!actionLoading}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={handleDialogConfirm}
              loading={!!actionLoading}
            >
              تأكيد
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="inline h-3.5 w-3.5" /> سيظهر السبب
            للتاجر في سجل المراجعة. العرض المرفوض يستطيع التاجر إعادة إرساله
            بعد التعديل.
          </div>
          <Textarea
            label="السبب"
            placeholder="اذكر السبب..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            required
          />
        </div>
      </Dialog>
    </div>
  );
}