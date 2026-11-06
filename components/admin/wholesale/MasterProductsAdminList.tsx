"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Package,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ShieldX,
  RotateCcw,
  AlertTriangle,
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
  STATUS_LABEL,
  STATUS_VARIANT,
  formatDate,
} from "@/components/wholesale/master-products/types";

type AdminItem = {
  id: number;
  name: string;
  brand: string | null;
  barcode: string | null;
  images: string[];
  status: string;
  version: number;
  createdAt: string;
  category: { id: number; name: string };
  createdByUser: { id: number; name: string; email: string };
  variantCount: number;
  merchantProductCount: number;
};

export interface MasterProductsAdminListProps {
  items: AdminItem[];
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

export function MasterProductsAdminList({
  items,
  statusCounts,
  currentStatus,
  currentSearch,
  pagination,
}: MasterProductsAdminListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState(currentSearch);
  const [status, setStatus] = useState(currentStatus);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    item: AdminItem;
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
    if (st && st !== "PENDING_REVIEW") params.set("status", st);
    else if (st === "PENDING_REVIEW") params.set("status", st);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs
      ? `/admin/wholesale/master-products?${qs}`
      : "/admin/wholesale/master-products";
  };

  const handleFilter = () => router.push(buildUrl({ page: 1 }));

  const execute = async (
    item: AdminItem,
    action: ActionKey,
    body: Record<string, any> = {}
  ) => {
    setActionLoading(`${action}-${item.id}`);
    try {
      const res = await fetch(
        `/api/admin/wholesale/master-products/${item.id}/${action}`,
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
      value: "SUSPENDED",
      label: `موقوف (${statusCounts.SUSPENDED ?? 0})`,
    },
    {
      value: "ARCHIVED",
      label: `مؤرشف/مرفوض (${statusCounts.ARCHIVED ?? 0})`,
    },
    { value: "ALL", label: "الكل" },
  ];

  const actionButtons = (item: AdminItem) => {
    const buttons = [];
    if (item.status === "PENDING_REVIEW" || item.status === "ARCHIVED") {
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
    if (item.status === "PENDING_REVIEW" || item.status === "ACTIVE") {
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
          إيقاف
        </Button>
      );
    }
    if (item.status === "SUSPENDED") {
      buttons.push(
        <Button
          key="restore"
          size="sm"
          variant="success"
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
        title="المنتجات الأصلية — مراجعة"
        description="مراجعة واعتماد هويات المنتجات التي يقدمها التجار"
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
          icon={Package}
          title="لا توجد منتجات"
          description="لم يُعثر على منتجات بهذه الحالة."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                    <th className="px-3 py-3">المنتج</th>
                    <th className="px-3 py-3">الفئة</th>
                    <th className="px-3 py-3">مقدم الطلب</th>
                    <th className="px-3 py-3">الحالة</th>
                    <th className="px-3 py-3">الإحصائيات</th>
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
                            {item.images[0] ? (
                              <img
                                src={item.images[0]}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Package className="h-4 w-4 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.brand || "بدون علامة"}
                              {item.barcode && ` · ${item.barcode}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-700">
                        {item.category.name}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-xs font-medium text-gray-900">
                          {item.createdByUser.name}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {item.createdByUser.email}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={STATUS_VARIANT[item.status] ?? "gray"}
                          dot
                        >
                          {STATUS_LABEL[item.status] ?? item.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        {item.variantCount} متغير
                        <br />
                        {item.merchantProductCount} تاجر
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          {actionButtons(item)}
                          <Link
                            href={`/wholesale/master-products/${item.id}`}
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
        title={
          dialog?.action === "reject" ? "رفض المنتج" : "إيقاف المنتج"
        }
        description={
          dialog?.item
            ? `سيتم ${dialog.action === "reject" ? "رفض" : "إيقاف"} "${dialog.item.name}"`
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
            لمقدم الطلب في سجل المراجعة.
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