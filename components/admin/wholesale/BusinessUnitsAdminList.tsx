"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  Factory,
  Globe2,
  Briefcase,
  Package,
  Store,
  GitBranch,
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
  TYPE_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  VERIF_LABEL,
  VERIF_VARIANT,
  getCapLabel,
  formatDate,
} from "@/components/wholesale/business-units/types";

type AdminBUItem = {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  capabilities: string[];
  registrationStatus: string;
  verificationStatus: string;
  logo: string | null;
  createdAt: string;
  owner: {
    id: number;
    displayName: string;
    email: string;
    userId: number;
  };
  legalEntity: { id: number; name: string } | null;
  counts: {
    merchantProducts: number;
    offers: number;
    inventoryLocations: number;
  };
};

export interface BusinessUnitsAdminListProps {
  items: AdminBUItem[];
  verificationCounts: Record<string, number>;
  currentVerification: string;
  currentType: string;
  currentSearch: string;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const TYPE_ICON = {
  FACTORY: Factory,
  IMPORTER: Globe2,
  WHOLESALER: Briefcase,
  DISTRIBUTOR: Package,
  SHOP: Store,
  BRANCH: GitBranch,
} as const;

export function BusinessUnitsAdminList({
  items,
  verificationCounts,
  currentVerification,
  currentType,
  currentSearch,
  pagination,
}: BusinessUnitsAdminListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(currentSearch);
  const [verification, setVerification] = useState(currentVerification);
  const [type, setType] = useState(currentType);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    item: AdminBUItem;
    action: "reject";
  } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    setSearch(currentSearch);
    setVerification(currentVerification);
    setType(currentType);
  }, [currentSearch, currentVerification, currentType]);

  const buildUrl = (next: {
    search?: string;
    verification?: string;
    type?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    const s = next.search ?? search;
    const v = next.verification ?? verification;
    const t = next.type ?? type;
    const p = next.page ?? 1;
    if (s.trim()) params.set("search", s.trim());
    if (v) params.set("verification", v);
    if (t) params.set("type", t);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs
      ? `/admin/wholesale/business-units?${qs}`
      : "/admin/wholesale/business-units";
  };

  const handleFilter = () => router.push(buildUrl({ page: 1 }));

  const execute = async (
    item: AdminBUItem,
    action: "verify" | "reject",
    body: Record<string, any>
  ) => {
    setActionLoading(`${action}-${item.id}`);
    try {
      const res = await fetch(
        `/api/admin/wholesale/business-units/${item.id}/verify`,
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

  const handleApprove = (item: AdminBUItem) => {
    execute(item, "verify", { status: "VERIFIED" });
  };

  const handleDialogConfirm = () => {
    if (!dialog) return;
    if (reason.trim().length < 3) {
      toast("السبب يجب أن يكون 3 أحرف على الأقل", "warning");
      return;
    }
    execute(dialog.item, "reject", {
      status: "REJECTED",
      reason: reason.trim(),
    });
  };

  const verificationOptions = [
    {
      value: "PENDING",
      label: `بانتظار التحقق (${verificationCounts.PENDING ?? 0})`,
    },
    {
      value: "VERIFIED",
      label: `موثق (${verificationCounts.VERIFIED ?? 0})`,
    },
    {
      value: "REJECTED",
      label: `مرفوض (${verificationCounts.REJECTED ?? 0})`,
    },
    { value: "ALL", label: "الكل" },
  ];

  const typeOptions = [
    { value: "", label: "كل الأنواع" },
    { value: "FACTORY", label: TYPE_LABEL.FACTORY },
    { value: "IMPORTER", label: TYPE_LABEL.IMPORTER },
    { value: "WHOLESALER", label: TYPE_LABEL.WHOLESALER },
    { value: "DISTRIBUTOR", label: TYPE_LABEL.DISTRIBUTOR },
    { value: "SHOP", label: TYPE_LABEL.SHOP },
    { value: "BRANCH", label: TYPE_LABEL.BRANCH },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="الأنشطة التجارية — التحقق"
        description="مراجعة وتوثيق الأنشطة التجارية (مصانع، شركات، موردون، موزعون)"
      />

      <Card padding="sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              البحث
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="بالاسم أو الـ slug"
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
              label="التحقق"
              value={verification}
              onChange={(e) => {
                setVerification(e.target.value);
                router.push(
                  buildUrl({ verification: e.target.value, page: 1 })
                );
              }}
              options={verificationOptions}
            />
          </div>
          <div className="lg:w-44">
            <Select
              label="النوع"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                router.push(buildUrl({ type: e.target.value, page: 1 }));
              }}
              options={typeOptions}
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
          icon={Building2}
          title="لا توجد أنشطة"
          description="لم يُعثر على أنشطة تجارية بهذه الحالة."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                    <th className="px-3 py-3">النشاط</th>
                    <th className="px-3 py-3">المالك</th>
                    <th className="px-3 py-3">النوع</th>
                    <th className="px-3 py-3">القدرات</th>
                    <th className="px-3 py-3">التحقق</th>
                    <th className="px-3 py-3">الإحصائيات</th>
                    <th className="px-3 py-3">التاريخ</th>
                    <th className="px-3 py-3">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const TypeIcon =
                      TYPE_ICON[item.type as keyof typeof TYPE_ICON] ??
                      Building2;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-orange-50">
                              {item.logo ? (
                                <img
                                  src={item.logo}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <TypeIcon className="h-4 w-4 text-[#ff5c00]" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-900">
                                {item.name}
                              </p>
                              <p className="truncate font-mono text-[10px] text-gray-500">
                                /{item.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-xs font-medium text-gray-900">
                            {item.owner.displayName}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {item.owner.email}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700">
                          {TYPE_LABEL[item.type] ?? item.type}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.capabilities.length === 0 ? (
                              <span className="text-[10px] text-gray-400">
                                —
                              </span>
                            ) : (
                              item.capabilities.map((cap) => (
                                <span
                                  key={cap}
                                  className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                                >
                                  {getCapLabel(cap)}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={
                              VERIF_VARIANT[item.verificationStatus] ?? "gray"
                            }
                            dot
                          >
                            {VERIF_LABEL[item.verificationStatus] ??
                              item.verificationStatus}
                          </Badge>
                          <div className="mt-1">
                            <Badge
                              variant={STATUS_VARIANT[item.status] ?? "gray"}
                              size="sm"
                            >
                              {STATUS_LABEL[item.status] ?? item.status}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[10px] text-gray-600">
                          {item.counts.merchantProducts} منتج
                          <br />
                          {item.counts.offers} عرض
                          <br />
                          {item.counts.inventoryLocations} موقع
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {item.verificationStatus === "PENDING" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  loading={
                                    actionLoading === `verify-${item.id}`
                                  }
                                  onClick={() => handleApprove(item)}
                                  iconLeft={
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  }
                                >
                                  توثيق
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => {
                                    setDialog({ item, action: "reject" });
                                    setReason("");
                                  }}
                                  iconLeft={
                                    <XCircle className="h-3.5 w-3.5" />
                                  }
                                >
                                  رفض
                                </Button>
                              </>
                            )}
                            {item.verificationStatus === "REJECTED" && (
                              <Button
                                size="sm"
                                variant="primary"
                                loading={
                                  actionLoading === `verify-${item.id}`
                                }
                                onClick={() => handleApprove(item)}
                                iconLeft={
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                }
                              >
                                إعادة توثيق
                              </Button>
                            )}
                            {item.verificationStatus === "VERIFIED" && (
                              <Badge variant="green" size="sm">
                                <ShieldCheck className="h-3 w-3" />
                                موثق
                              </Badge>
                            )}
                            <Link
                              href={`/wholesale/business-units/${item.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#ff5c00]"
                              aria-label="عرض التفاصيل"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
        title="رفض توثيق النشاط"
        description={
          dialog?.item
            ? `سيتم رفض توثيق "${dialog.item.name}" من ${dialog.item.owner.displayName}`
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
              تأكيد الرفض
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="inline h-3.5 w-3.5" /> سيظهر السبب
            للمالك. يمكنه إعادة تقديم الطلب لاحقًا بعد التصحيح.
          </div>
          <Textarea
            label="السبب"
            placeholder="اذكر سبب رفض التوثيق..."
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