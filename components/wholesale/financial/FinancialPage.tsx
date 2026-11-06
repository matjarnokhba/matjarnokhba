"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BookOpen, Receipt, CreditCard, Building2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/ui/cn";
import { LedgerTab } from "./LedgerTab";
import { InvoicesTab } from "./InvoicesTab";
import { PaymentsTab } from "./PaymentsTab";
import {
  BU_TYPE_LABEL,
  type BUOption,
  type LedgerAccount,
  type TrialBalance,
  type InvoiceListItem,
  type PaymentListItem,
} from "./types";

type Tab = "ledger" | "invoices" | "payments";

export interface FinancialPageProps {
  businessUnits: BUOption[];
  initialBusinessUnitId: number;
  accounts: LedgerAccount[];
  trialBalance: TrialBalance;
  invoices: InvoiceListItem[];
  payments: PaymentListItem[];
  invoicesPagination: { page: number; total: number; totalPages: number };
  paymentsPagination: { page: number; total: number; totalPages: number };
}

export function FinancialPage({
  businessUnits,
  initialBusinessUnitId,
  accounts,
  trialBalance,
  invoices,
  payments,
  invoicesPagination,
  paymentsPagination,
}: FinancialPageProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ledger");

  // Check URL query param for tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "invoices" || t === "payments" || t === "ledger") {
      setTab(t);
    }
  }, []);

  const handleBUChange = (newBUId: string) => {
    router.push(`/wholesale/financial?businessUnitId=${newBUId}`);
  };

  if (businessUnits.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="المالية" description="دفتر الحسابات والفواتير" />
        <Card>
          <p className="text-sm text-gray-500">
            أنشئ نشاطًا تجاريًا أولًا لعرض السجلات المالية.
          </p>
        </Card>
      </div>
    );
  }

  const buOptions = businessUnits.map((b) => ({
    value: String(b.id),
    label: `${b.name} (${BU_TYPE_LABEL[b.type] ?? b.type})`,
  }));

  const tabs: Array<{ key: Tab; label: string; icon: typeof BookOpen }> = [
    { key: "ledger", label: "دفتر الحسابات", icon: BookOpen },
    { key: "invoices", label: "الفواتير", icon: Receipt },
    { key: "payments", label: "المدفوعات", icon: CreditCard },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="المالية"
        description="دفتر الحسابات، الفواتير، والم payments لكل نشاط"
        action={
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Building2 className="h-4 w-4" />
            {businessUnits.length} نشاط
          </div>
        }
      />

      <Card padding="sm">
        <div className="sm:max-w-md">
          <Select
            label="النشاط"
            value={String(initialBusinessUnitId)}
            onChange={(e) => handleBUChange(e.target.value)}
            options={buOptions}
          />
        </div>
      </Card>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-[#ff5c00] text-[#ff5c00]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "ledger" && (
        <LedgerTab
          businessUnitId={initialBusinessUnitId}
          accounts={accounts}
          trialBalance={trialBalance}
        />
      )}

      {tab === "invoices" && (
        <InvoicesTab
          businessUnitId={initialBusinessUnitId}
          invoices={invoices}
          pagination={invoicesPagination}
        />
      )}

      {tab === "payments" && (
        <PaymentsTab
          businessUnitId={initialBusinessUnitId}
          payments={payments}
          pagination={paymentsPagination}
        />
      )}
    </div>
  );
}