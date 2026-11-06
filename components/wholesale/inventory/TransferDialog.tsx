"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowRightLeft,
  Loader2,
  AlertCircle,
  Package,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/lib/hooks/useToast";
import {
  ACCOUNT_TYPE_LABEL,
  type InventoryAccountSummary,
} from "./types";

export interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  businessUnitId: number;
  accounts: InventoryAccountSummary[];
  merchantVariantId: number;
  sourceAccountId: number;
  productName: string;
  sku: string | null;
  maxQuantity: number;
  onSuccess: () => void;
}

export function TransferDialog({
  open,
  onClose,
  businessUnitId,
  accounts,
  merchantVariantId,
  sourceAccountId,
  productName,
  sku,
  maxQuantity,
  onSuccess,
}: TransferDialogProps) {
  const { toast } = useToast();
  const [toAccountId, setToAccountId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setToAccountId("");
      setQuantity(String(maxQuantity > 0 ? Math.min(maxQuantity, 1) : 0));
      setNotes("");
      setError(null);
    }
  }, [open, maxQuantity]);

  // Source account (readonly display)
  const sourceAccount = useMemo(
    () => accounts.find((a) => a.id === sourceAccountId),
    [accounts, sourceAccountId]
  );

  // Available destination accounts (exclude source, only active)
  const destinationAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.id !== sourceAccountId && a.isActive
      ),
    [accounts, sourceAccountId]
  );

  const targetAccount = useMemo(
    () =>
      toAccountId
        ? accounts.find((a) => String(a.id) === toAccountId)
        : null,
    [accounts, toAccountId]
  );

  const quantityNum = parseInt(quantity, 10);
  const isValid =
    !!targetAccount &&
    !isNaN(quantityNum) &&
    quantityNum >= 1 &&
    quantityNum <= maxQuantity;

  const handleSubmit = async () => {
    if (submitting || !isValid || !targetAccount) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnitId}/inventory/transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            merchantVariantId,
            fromAccountId: sourceAccountId,
            toAccountId: targetAccount.id,
            quantity: quantityNum,
            notes: notes.trim() || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        const msg = data.message || "فشل التحويل";
        setError(msg);
        toast(msg, "error");
        return;
      }
      toast(
        `تم تحويل ${quantityNum} قطعة بنجاح (${
          data.transferNumber ?? ""
        })`.trim(),
        "success"
      );
      onSuccess();
    } catch {
      setError("خطأ في الاتصال");
      toast("خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const destinationOptions = destinationAccounts.map((a) => ({
    value: String(a.id),
    label: `${ACCOUNT_TYPE_LABEL[a.type] ?? a.type} — ${a.locationName}`,
  }));

  const sourceLabel = sourceAccount
    ? `${ACCOUNT_TYPE_LABEL[sourceAccount.type] ?? sourceAccount.type} — ${
        sourceAccount.locationName
      }`
    : "—";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-gray-400" />
          تحويل مخزون داخلي
        </span>
      }
      description="نقل كمية من حساب إلى آخر داخل نفس النشاط التجاري (لا يُسجَّل كبيع)"
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!isValid}
            iconLeft={
              !submitting ? <ArrowRightLeft className="h-4 w-4" /> : undefined
            }
          >
            تنفيذ التحويل
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Product summary */}
        <div className="rounded-lg bg-gray-50 p-3">
          <div className="flex items-start gap-2">
            <Package className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {productName}
              </p>
              {sku && (
                <p className="text-xs text-gray-500 font-mono">{sku}</p>
              )}
            </div>
          </div>
        </div>

        {/* Source → Destination */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              من حساب
            </label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              <div className="flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate">{sourceLabel}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                متاح: {maxQuantity} قطعة
              </p>
            </div>
          </div>
          <div>
            <Select
              label="إلى حساب"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              placeholder="اختر الحساب الهدف"
              options={destinationOptions}
              disabled={submitting}
              required
            />
            {targetAccount && (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                {ACCOUNT_TYPE_LABEL[targetAccount.type] ?? targetAccount.type}
              </p>
            )}
          </div>
        </div>

        {/* Quantity */}
        <Input
          label="الكمية"
          type="number"
          min="1"
          max={String(maxQuantity)}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          hint={`الحد الأقصى: ${maxQuantity} قطعة`}
          disabled={submitting}
        />

        {/* Notes */}
        <Textarea
          label="ملاحظات (اختياري)"
          placeholder="سبب التحويل، مرجع، أو أي معلومة إضافية..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          disabled={submitting}
        />

        {/* Info */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900">
          <AlertCircle className="inline h-3 w-3" /> التحويل الداخلي ينشئ
          حركتين (TRANSFER_OUT + TRANSFER_IN) بدون أي أثر مالي أو تسجيل بيع.
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}