"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Play,
  Package,
  Truck,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/lib/hooks/useToast";

type ActionKey =
  | "confirm"
  | "cancel"
  | "process"
  | "ready"
  | "ship"
  | "receive";

interface ActionConfig {
  key: ActionKey;
  label: string;
  icon: typeof CheckCircle2;
  variant: "primary" | "success" | "danger" | "outline" | "secondary";
  endpoint: string;
  successStatus: string;
  requiresReason?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
}

const BUYER_ACTIONS: Record<string, ActionConfig[]> = {
  PENDING: [
    {
      key: "confirm",
      label: "تأكيد الطلب",
      icon: CheckCircle2,
      variant: "success",
      endpoint: "confirm",
      successStatus: "CONFIRMED",
      confirmTitle: "تأكيد الطلب",
      confirmDescription:
        "سيتم تأكيد الطلب وإبلاغ البائع لبدء التجهيز.",
    },
    {
      key: "cancel",
      label: "إلغاء الطلب",
      icon: XCircle,
      variant: "danger",
      endpoint: "cancel",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  CONFIRMED: [
    {
      key: "cancel",
      label: "إلغاء الطلب",
      icon: XCircle,
      variant: "danger",
      endpoint: "cancel",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  SHIPPED: [
    {
      key: "receive",
      label: "تأكيد الاستلام",
      icon: Inbox,
      variant: "success",
      endpoint: "receive",
      successStatus: "DELIVERED",
      confirmTitle: "تأكيد استلام الطلب",
      confirmDescription:
        "سيتم إضافة المنتجات إلى مخزونك تلقائيًا. تأكد من استلام كل البنود قبل المتابعة.",
    },
  ],
};

const SELLER_ACTIONS: Record<string, ActionConfig[]> = {
  PENDING: [
    {
      key: "confirm",
      label: "قبول الطلب",
      icon: CheckCircle2,
      variant: "success",
      endpoint: "confirm",
      successStatus: "CONFIRMED",
      confirmTitle: "قبول الطلب",
      confirmDescription:
        "سيتم تثبيت حجز المخزون وبدء دورة التجهيز.",
    },
    {
      key: "cancel",
      label: "رفض الطلب",
      icon: XCircle,
      variant: "danger",
      endpoint: "cancel",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  CONFIRMED: [
    {
      key: "process",
      label: "بدء التجهيز",
      icon: Play,
      variant: "primary",
      endpoint: "process",
      successStatus: "PROCESSING",
      confirmTitle: "بدء التجهيز",
      confirmDescription: "سيتم تحويل الطلب لحالة قيد التجهيز.",
    },
    {
      key: "cancel",
      label: "إلغاء",
      icon: XCircle,
      variant: "outline",
      endpoint: "cancel",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  PROCESSING: [
    {
      key: "ready",
      label: "تحديد جاهز للشحن",
      icon: Package,
      variant: "success",
      endpoint: "ready",
      successStatus: "READY",
      confirmTitle: "جاهز للشحن",
      confirmDescription:
        "سيُعلم المشتري بأن الطلب جاهز للشحن.",
    },
  ],
  READY: [
    {
      key: "ship",
      label: "تأكيد الشحن",
      icon: Truck,
      variant: "primary",
      endpoint: "ship",
      successStatus: "SHIPPED",
      confirmTitle: "تأكيد الشحن",
      confirmDescription:
        "سيُعلم المشتري بأن الطلب في الطريق إليه.",
    },
  ],
};

export interface OrderActionsProps {
  orderId: number;
  currentStatus: string;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  onStatusChange: (status: string) => void;
}

export function OrderActions({
  orderId,
  currentStatus,
  isBuyer,
  isSeller,
  isAdmin,
  onStatusChange,
}: OrderActionsProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [dialog, setDialog] = useState<ActionConfig | null>(null);
  const [reason, setReason] = useState("");

  const buyerActions = isBuyer ? BUYER_ACTIONS[currentStatus] ?? [] : [];
  const sellerActions = isSeller ? SELLER_ACTIONS[currentStatus] ?? [] : [];

  // Merge deduplicated: if user is both buyer and seller, prefer seller actions
  const seen = new Set<ActionKey>();
  const actions: ActionConfig[] = [];
  for (const a of sellerActions) {
    if (!seen.has(a.key)) {
      seen.add(a.key);
      actions.push(a);
    }
  }
  for (const a of buyerActions) {
    if (!seen.has(a.key)) {
      seen.add(a.key);
      actions.push(a);
    }
  }

  if (actions.length === 0) {
    return null;
  }

  const execute = async (config: ActionConfig, body: Record<string, any>) => {
    setActionLoading(config.key);
    try {
      const res = await fetch(
        `/api/wholesale/orders/${orderId}/${config.endpoint}`,
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
      onStatusChange(config.successStatus);
      setDialog(null);
      setReason("");

      // If receive, refresh to show updated data
      if (config.key === "receive") {
        router.refresh();
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleClick = (config: ActionConfig) => {
    if (config.requiresReason) {
      setDialog(config);
      setReason("");
    } else if (config.confirmTitle) {
      setDialog(config);
    } else {
      execute(config, {});
    }
  };

  const handleConfirm = () => {
    if (!dialog) return;
    if (dialog.requiresReason && reason.trim().length < 3) {
      toast("السبب يجب أن يكون 3 أحرف على الأقل", "warning");
      return;
    }
    const body = dialog.requiresReason ? { reason: reason.trim() } : {};
    execute(dialog, body);
  };

  return (
    <>
      <Card>
        <h3 className="mb-3 text-sm font-bold text-gray-900">إجراءات</h3>
        <div className="space-y-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.key}
                variant={a.variant}
                fullWidth
                loading={actionLoading === a.key}
                onClick={() => handleClick(a)}
                iconLeft={
                  actionLoading !== a.key ? (
                    <Icon className="h-4 w-4" />
                  ) : undefined
                }
              >
                {a.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-3 flex items-start gap-1 text-xs text-gray-500">
          <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          تُسجَّل كل عملية في سجل التدقيق.
        </p>
      </Card>

      <Dialog
        open={!!dialog}
        onClose={() => {
          setDialog(null);
          setReason("");
        }}
        title={dialog?.confirmTitle ?? dialog?.label ?? ""}
        description={dialog?.confirmDescription}
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
              variant={dialog?.requiresReason ? "danger" : "primary"}
              onClick={handleConfirm}
              loading={!!actionLoading}
            >
              تأكيد
            </Button>
          </>
        }
      >
        {dialog?.requiresReason ? (
          <Textarea
            label="السبب"
            placeholder="اذكر السبب..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            required
          />
        ) : (
          <p className="text-sm text-gray-700">
            هل أنت متأكد من تنفيذ هذا الإجراء؟
          </p>
        )}
      </Dialog>
    </>
  );
}