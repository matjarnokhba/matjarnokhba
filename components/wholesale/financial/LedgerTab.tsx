"use client";

import { useState } from "react";
import {
  BookOpen,
  Scale,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_VARIANT,
  formatMoney,
  type LedgerAccount,
  type TrialBalance,
} from "./types";
import { AccountStatementDialog } from "./AccountStatementDialog";

export interface LedgerTabProps {
  businessUnitId: number;
  accounts: LedgerAccount[];
  trialBalance: TrialBalance;
}

export function LedgerTab({
  businessUnitId,
  accounts,
  trialBalance,
}: LedgerTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<LedgerAccount | null>(
    null
  );

  const openStatement = (acc: LedgerAccount) => {
    setSelectedAccount(acc);
    setDialogOpen(true);
  };

  // Group accounts by type
  const grouped = accounts.reduce<Record<string, LedgerAccount[]>>(
    (acc, a) => {
      if (!acc[a.type]) acc[a.type] = [];
      acc[a.type].push(a);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-4">
      {/* Trial balance summary */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <Scale className="h-4 w-4 text-gray-400" />
              ميزان المراجعة
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              يجب أن يتساوى مجموع المدين والدائن
            </p>
          </div>
          {trialBalance.isBalanced ? (
            <Badge variant="green">
              <Scale className="h-3 w-3" />
              متوازن
            </Badge>
          ) : (
            <Badge variant="red">
              <AlertTriangle className="h-3 w-3" />
              غير متوازن
            </Badge>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-700">مجموع المدين</p>
            <p className="mt-1 text-lg font-black text-blue-900">
              {formatMoney(trialBalance.totalDebit)} د.م
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">مجموع الدائن</p>
            <p className="mt-1 text-lg font-black text-emerald-900">
              {formatMoney(trialBalance.totalCredit)} د.م
            </p>
          </div>
        </div>
      </Card>

      {/* Accounts */}
      {accounts.length === 0 ? (
        <Empty
          icon={BookOpen}
          title="لا توجد حسابات بعد"
          description="ستنشأ الحسابات تلقائيًا عند أول معاملة مالية."
        />
      ) : (
        Object.entries(grouped).map(([type, typeAccounts]) => (
          <Card key={type} padding="none">
            <div className="border-b border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Badge variant={ACCOUNT_TYPE_VARIANT[type] ?? "gray"}>
                  {ACCOUNT_TYPE_LABEL[type] ?? type}
                </Badge>
                <span className="text-xs font-normal text-gray-500">
                  {typeAccounts.length} حساب
                </span>
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {typeAccounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openStatement(a)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs text-gray-400">
                        {a.code}
                      </span>
                      <span className="font-medium text-gray-900">
                        {a.name}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      مدين: {formatMoney(a.debitTotal)} · دائن:{" "}
                      {formatMoney(a.creditTotal)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-lg font-black ${
                        a.balance >= 0 ? "text-gray-900" : "text-red-600"
                      }`}
                    >
                      {formatMoney(a.balance)} د.م
                    </span>
                    <ChevronLeft className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        ))
      )}

      <AccountStatementDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelectedAccount(null);
        }}
        businessUnitId={businessUnitId}
        account={selectedAccount}
      />
    </div>
  );
}