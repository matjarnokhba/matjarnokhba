"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Layers,
  Search,
  AlertCircle,
  Eye,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/ui/cn";
import { VariantDetailDialog } from "./VariantDetailDialog";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_VARIANT,
  BATCH_SOURCE_LABEL,
  BATCH_SOURCE_VARIANT,
  BU_TYPE_LABEL,
  formatDateTime,
  formatNumber,
  type BalanceRow,
  type BatchRow,
  type InventoryAccountSummary,
  type BUOption,
} from "./types";

export interface InventoryPageProps {
  businessUnits: BUOption[];
  initialBusinessUnitId: number;
  accounts: InventoryAccountSummary[];
  initialBalances: BalanceRow[];
  initialBatches: BatchRow[];
}

type Tab = "balances" | "batches";

export function InventoryPage({
  businessUnits,
  initialBusinessUnitId,
  accounts,
  initialBalances,
  initialBatches,
}: InventoryPageProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("balances");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null
  );

  const handleBUChange = (newBUId: string) => {
    router.push(`/wholesale/inventory?businessUnitId=${newBUId}`);
  };

  // Filter rows
  const filteredBalances = initialBalances.filter((r) => {
    if (accountFilter && r.accountType !== accountFilter) return false;
    if (search.trim().length >= 2) {
      const q = search.trim().toLowerCase();
      const match =
        r.productName.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.barcode ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const filteredBatches = initialBatches.filter((r) => {
    if (accountFilter && r.accountType !== accountFilter) return false;
    if (search.trim().length >= 2) {
      const q = search.trim().toLowerCase();
      const match =
        r.productName.toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Totals
  const totalOnHand = filteredBalances.reduce((s, r) => s + r.onHand, 0);
  const totalReserved = filteredBalances.reduce((s, r) => s + r.reserved, 0);
  const totalAvailable = filteredBalances.reduce((s, r) => s + r.available, 0);

  const openVariantDetail = (merchantVariantId: number) => {
    setSelectedVariantId(merchantVariantId);
    setDialogOpen(true);
  };

  if (businessUnits.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="المخزون" description="متابعة أرصدة وحركات مخزونك" />
        <Empty
          icon={Package}
          title="لا توجد أنشطة تجارية"
          description="أنشئ نشاطًا تجاريًا أولًا لإدارة مخزونه."
        />
      </div>
    );
  }

  const buOptions = businessUnits.map((b) => ({
    value: String(b.id),
    label: `${b.name} (${BU_TYPE_LABEL[b.type] ?? b.type})`,
  }));

  const accountTypeOptions = [
    { value: "", label: "كل أنواع الحسابات" },
    { value: "RETAIL", label: ACCOUNT_TYPE_LABEL.RETAIL },
    { value: "WHOLESALE", label: ACCOUNT_TYPE_LABEL.WHOLESALE },
    { value: "QUARANTINE", label: ACCOUNT_TYPE_LABEL.QUARANTINE },
    { value: "DAMAGED", label: ACCOUNT_TYPE_LABEL.DAMAGED },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المخزون"
        description="أرصدة ودفعات المخزون لكل نشاط تجاري"
        action={
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Building2 className="h-4 w-4" />
            {accounts.length} حساب مخزون
          </div>
        }
      />

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              البحث
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="اسم المنتج، SKU، أو الباركود"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
            </div>
          </div>
          <div className="sm:w-56">
            <Select
              label="النشاط"
              value={String(initialBusinessUnitId)}
              onChange={(e) => handleBUChange(e.target.value)}
              options={buOptions}
            />
          </div>
          <div className="sm:w-48">
            <Select
              label="نوع الحساب"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              options={accountTypeOptions}
            />
          </div>
        </div>
      </Card>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-gray-500">الإجمالي</p>
          <p className="mt-1 text-2xl font-black text-gray-900">
            {formatNumber(totalOnHand)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">متوفر للبيع</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">
            {formatNumber(totalAvailable)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500">محجوز</p>
          <p className="mt-1 text-2xl font-black text-amber-600">
            {formatNumber(totalReserved)}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("balances")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "balances"
              ? "border-[#ff5c00] text-[#ff5c00]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          <Package className="h-4 w-4" />
          الأرصدة ({filteredBalances.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("batches")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "batches"
              ? "border-[#ff5c00] text-[#ff5c00]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          <Layers className="h-4 w-4" />
          الدفعات ({filteredBatches.length})
        </button>
      </div>

      {/* Content */}
      {tab === "balances" && (
        <>
          {filteredBalances.length === 0 ? (
            <Empty
              icon={Package}
              title="لا توجد أرصدة"
              description="لم يُستلم أي مخزون بعد — استلم طلب جملة أو أضف مخزونًا."
            />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                      <th className="px-3 py-3">المنتج</th>
                      <th className="px-3 py-3">SKU</th>
                      <th className="px-3 py-3">الموقع</th>
                      <th className="px-3 py-3">الحساب</th>
                      <th className="px-3 py-3">الإجمالي</th>
                      <th className="px-3 py-3">محجوز</th>
                      <th className="px-3 py-3">متوفر</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalances.map((r) => (
                      <tr
                        key={`${r.merchantVariantId}-${r.inventoryAccountId}`}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {r.productName}
                            </p>
                            {r.variantAttributes.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {r.variantAttributes.map((a, i) => (
                                  <span
                                    key={i}
                                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                                  >
                                    {a.name}: {a.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-500">
                          {r.sku || "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700">
                          {r.locationName}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={
                              ACCOUNT_TYPE_VARIANT[r.accountType] ?? "gray"
                            }
                            size="sm"
                          >
                            {ACCOUNT_TYPE_LABEL[r.accountType] ?? r.accountType}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 font-bold text-gray-900">
                          {formatNumber(r.onHand)}
                        </td>
                        <td className="px-3 py-3 text-amber-600">
                          {formatNumber(r.reserved)}
                        </td>
                        <td className="px-3 py-3 font-bold text-emerald-700">
                          {formatNumber(r.available)}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() =>
                              openVariantDetail(r.merchantVariantId)
                            }
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#ff5c00]"
                            aria-label="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "batches" && (
        <>
          {filteredBatches.length === 0 ? (
            <Empty
              icon={Layers}
              title="لا توجد دفعات"
              description="تظهر الدفعات عند استلام مخزون جديد."
            />
          ) : (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs font-medium text-gray-600">
                      <th className="px-3 py-3">المنتج</th>
                      <th className="px-3 py-3">المصدر</th>
                      <th className="px-3 py-3">المرجع</th>
                      <th className="px-3 py-3">الحساب</th>
                      <th className="px-3 py-3">المستلم</th>
                      <th className="px-3 py-3">المتبقي</th>
                      <th className="px-3 py-3">التكلفة</th>
                      <th className="px-3 py-3">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((b) => (
                      <tr
                        key={b.id}
                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-3 py-3">
                          <p className="font-medium text-gray-900">
                            {b.productName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {b.sku || "—"}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={
                              BATCH_SOURCE_VARIANT[b.sourceType] ?? "gray"
                            }
                            size="sm"
                          >
                            {BATCH_SOURCE_LABEL[b.sourceType] ?? b.sourceType}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-600">
                          {b.sourceReferenceId ? `#${b.sourceReferenceId}` : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={
                              ACCOUNT_TYPE_VARIANT[b.accountType] ?? "gray"
                            }
                            size="sm"
                          >
                            {ACCOUNT_TYPE_LABEL[b.accountType] ?? b.accountType}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-gray-700">
                          {formatNumber(b.quantityReceived)}
                        </td>
                        <td className="px-3 py-3 font-bold text-emerald-700">
                          {formatNumber(b.quantityRemaining)}
                        </td>
                        <td className="px-3 py-3 text-gray-700">
                          {b.unitCost.toFixed(2)} د.م
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">
                          {formatDateTime(b.receivedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <VariantDetailDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedVariantId(null);
        }}
        businessUnitId={initialBusinessUnitId}
        merchantVariantId={selectedVariantId}
      />
    </div>
  );
}