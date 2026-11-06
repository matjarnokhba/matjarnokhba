"use client";

import { useState, useEffect } from "react";
import { Loader2, Calendar, AlertCircle } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import {
  formatDate,
  formatMoney,
  type LedgerAccount,
  type StatementResult,
} from "./types";

export interface AccountStatementDialogProps {
  open: boolean;
  onClose: () => void;
  businessUnitId: number;
  account: LedgerAccount | null;
}

export function AccountStatementDialog({
  open,
  onClose,
  businessUnitId,
  account,
}: AccountStatementDialogProps) {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [fromDate, setFromDate] = useState(
    thirtyDaysAgo.toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatementResult | null>(null);

  useEffect(() => {
    if (!open || !account) {
      setData(null);
      setError(null);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, account?.id]);

  const load = async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const from = new Date(fromDate).toISOString();
      const to = new Date(toDate + "T23:59:59").toISOString();
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnitId}/ledger/${account.id}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "فشل تحميل كشف الحساب");
        return;
      }
      setData(json.statement);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        account ? `${account.code} · ${account.name}` : "كشف حساب"
      }
      description={
        data
          ? `الرصيد الختامي: ${formatMoney(data.closingBalance)} د.م`
          : undefined
      }
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <Input
              label="من"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Input
              label="إلى"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="h-10 rounded-lg bg-[#ff5c00] px-4 text-sm font-semibold text-white hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? "جارٍ..." : "تحديث"}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="inline h-4 w-4" /> {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
          </div>
        )}

        {data && !loading && (
          <>
            {data.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                <Calendar className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                لا توجد حركات في هذه الفترة
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-right text-xs text-gray-600">
                      <th className="px-3 py-2">التاريخ</th>
                      <th className="px-3 py-2">الوصف</th>
                      <th className="px-3 py-2">مدين</th>
                      <th className="px-3 py-2">دائن</th>
                      <th className="px-3 py-2">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr
                        key={r.lineId}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {formatDate(r.date)}
                        </td>
                        <td className="px-3 py-2">
                          <p className="text-gray-900">{r.description}</p>
                          <p className="text-[10px] text-gray-400">
                            {r.referenceType} #{r.referenceId}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.debit > 0 ? formatMoney(r.debit) : "—"}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {r.credit > 0 ? formatMoney(r.credit) : "—"}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900">
                          {formatMoney(r.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">الرصيد الافتتاحي</span>
                <span className="font-bold text-gray-900">
                  {formatMoney(data.openingBalance)} د.م
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-gray-200 pt-1">
                <span className="text-gray-600">الرصيد الختامي</span>
                <span className="font-bold text-[#ff5c00]">
                  {formatMoney(data.closingBalance)} د.م
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}