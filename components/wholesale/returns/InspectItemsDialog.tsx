"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/lib/hooks/useToast";
import {
  RETURN_ITEM_CONDITION_LABEL,
  type ReturnDetail,
} from "./types";

type InspectRow = {
  returnOrderItemId: number;
  condition: "SELLABLE" | "DAMAGED" | "QUARANTINED" | "REJECTED_RETURN";
  quantityAccepted: number;
};

type InspectState = {
  condition: InspectRow["condition"];
  quantityAccepted: string;
};

const CONDITION_OPTIONS = [
  { value: "SELLABLE", label: RETURN_ITEM_CONDITION_LABEL.SELLABLE },
  { value: "DAMAGED", label: RETURN_ITEM_CONDITION_LABEL.DAMAGED },
  { value: "QUARANTINED", label: RETURN_ITEM_CONDITION_LABEL.QUARANTINED },
  {
    value: "REJECTED_RETURN",
    label: RETURN_ITEM_CONDITION_LABEL.REJECTED_RETURN,
  },
];

export interface InspectItemsDialogProps {
  open: boolean;
  onClose: () => void;
  items: ReturnDetail["items"];
  onConfirm: (data: InspectRow[]) => Promise<void>;
  loading: boolean;
}

export function InspectItemsDialog({
  open,
  onClose,
  items,
  onConfirm,
  loading,
}: InspectItemsDialogProps) {
  const { toast } = useToast();
  const [states, setStates] = useState<Record<number, InspectState>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<number, InspectState> = {};
      for (const item of items) {
        initial[item.id] = {
          condition: "SELLABLE",
          quantityAccepted: String(item.quantityReceived),
        };
      }
      setStates(initial);
    }
  }, [open, items]);

  const handleSubmit = async () => {
    const data: InspectRow[] = [];
    for (const item of items) {
      const s = states[item.id];
      if (!s) {
        toast(`لم يتم تحديد بيانات البند "${item.productName}"`, "warning");
        return;
      }
      const qty = parseInt(s.quantityAccepted, 10);
      if (isNaN(qty) || qty < 0) {
        toast(`كمية غير صحيحة للبند "${item.productName}"`, "warning");
        return;
      }
      if (qty > item.quantityReceived) {
        toast(
          `الكمية المقبولة (${qty}) تتجاوز المستلمة (${item.quantityReceived})`,
          "warning"
        );
        return;
      }
      data.push({
        returnOrderItemId: item.id,
        condition: s.condition,
        quantityAccepted: qty,
      });
    }

    const totalAccepted = data.reduce((s, d) => s + d.quantityAccepted, 0);
    if (totalAccepted === 0) {
      toast(
        "يجب قبول قطعة واحدة على الأقل (استخدم الرفض/الإلغاء بدلًا من ذلك)",
        "warning"
      );
      return;
    }

    await onConfirm(data);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-gray-400" />
          فحص المنتجات
        </span>
      }
      description="حدد حالة كل بند والكمية المقبولة للإرجاع"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            تأكيد الفحص
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {items.map((item) => {
          const s = states[item.id];
          return (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 p-3"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">
                    {item.productName}
                  </p>
                  {item.variantAttributes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.variantAttributes.map((a, i) => (
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
                <span className="text-xs text-gray-500">
                  مستلم: {item.quantityReceived}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Select
                  label="الحالة"
                  value={s?.condition ?? "SELLABLE"}
                  onChange={(e) =>
                    setStates({
                      ...states,
                      [item.id]: {
                        ...(states[item.id] ?? {
                          quantityAccepted: String(item.quantityReceived),
                        }),
                        condition: e.target.value as InspectRow["condition"],
                      },
                    })
                  }
                  options={CONDITION_OPTIONS}
                  disabled={loading}
                />
                <Input
                  label="الكمية المقبولة"
                  type="number"
                  min="0"
                  max={String(item.quantityReceived)}
                  value={s?.quantityAccepted ?? ""}
                  onChange={(e) =>
                    setStates({
                      ...states,
                      [item.id]: {
                        ...(states[item.id] ?? { condition: "SELLABLE" }),
                        quantityAccepted: e.target.value,
                      },
                    })
                  }
                  disabled={loading}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}