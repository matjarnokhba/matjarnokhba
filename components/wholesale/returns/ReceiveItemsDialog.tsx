"use client";

import { useState, useEffect } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/lib/hooks/useToast";
import type { ReturnDetail } from "./types";

type ReceiveRow = {
  returnOrderItemId: number;
  quantityReceived: number;
};

export interface ReceiveItemsDialogProps {
  open: boolean;
  onClose: () => void;
  items: ReturnDetail["items"];
  onConfirm: (data: ReceiveRow[]) => Promise<void>;
  loading: boolean;
}

export function ReceiveItemsDialog({
  open,
  onClose,
  items,
  onConfirm,
  loading,
}: ReceiveItemsDialogProps) {
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  // Reset on open
  useEffect(() => {
    if (open) {
      const initial: Record<number, string> = {};
      for (const item of items) {
        initial[item.id] = String(item.quantityRequested);
      }
      setQuantities(initial);
    }
  }, [open, items]);

  const handleSubmit = async () => {
    const data: ReceiveRow[] = [];
    for (const item of items) {
      const raw = quantities[item.id] ?? "";
      const qty = parseInt(raw, 10);
      if (isNaN(qty) || qty < 0) {
        toast(`كمية غير صحيحة للبند "${item.productName}"`, "warning");
        return;
      }
      if (qty > item.quantityRequested) {
        toast(
          `الكمية المستلمة (${qty}) تتجاوز المطلوبة (${item.quantityRequested}) للبند "${item.productName}"`,
          "warning"
        );
        return;
      }
      data.push({ returnOrderItemId: item.id, quantityReceived: qty });
    }

    const totalReceived = data.reduce((s, d) => s + d.quantityReceived, 0);
    if (totalReceived === 0) {
      toast("يجب استلام قطعة واحدة على الأقل", "warning");
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
          <Inbox className="h-5 w-5 text-gray-400" />
          استلام المنتجات
        </span>
      }
      description="أدخل الكميات الفعلية المستلمة لكل بند"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} loading={loading}>
            تأكيد الاستلام
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {items.map((item) => (
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
                مطلوب: {item.quantityRequested}
              </span>
            </div>
            <Input
              label="الكمية المستلمة"
              type="number"
              min="0"
              max={String(item.quantityRequested)}
              value={quantities[item.id] ?? ""}
              onChange={(e) =>
                setQuantities({ ...quantities, [item.id]: e.target.value })
              }
              disabled={loading}
            />
          </div>
        ))}
      </div>
    </Dialog>
  );
}