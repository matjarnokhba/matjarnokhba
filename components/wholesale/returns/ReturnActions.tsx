"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  Send,
  Inbox,
  ClipboardCheck,
  PackageCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/lib/hooks/useToast";
import { ReceiveItemsDialog } from "./ReceiveItemsDialog";
import { InspectItemsDialog } from "./InspectItemsDialog";
import type { ReturnDetail } from "./types";

type ActionKey =
  | "approve"
  | "reject"
  | "mark-sent"
  | "receive"
  | "inspect"
  | "complete"
  | "cancel";

interface ActionConfig {
  key: ActionKey;
  label: string;
  icon: typeof CheckCircle2;
  variant: "primary" | "success" | "danger" | "outline" | "secondary";
  successStatus: string;
  requiresReason?: boolean;
  opensDialog?: "receive" | "inspect";
  confirmTitle?: string;
  confirmDescription?: string;
}

const BUYER_ACTIONS: Record<string, ActionConfig[]> = {
  APPROVED: [
    {
      key: "mark-sent",
      label: "تم الإرسال",
      icon: Send,
      variant: "primary",
      successStatus: "PENDING_SHIPMENT",
      confirmTitle: "تأكيد إرسال المرتجع",
      confirmDescription:
        "سيُعلم البائع بأنك أرسلت المنتجات. تأكد من الشحن قبل المتابعة.",
    },
    {
      key: "cancel",
      label: "إلغاء المرتجع",
      icon: XCircle,
      variant: "danger",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  REQUESTED: [
    {
      key: "cancel",
      label: "إلغاء المرتجع",
      icon: XCircle,
      variant: "danger",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  PENDING_SHIPMENT: [
    {
      key: "cancel",
      label: "إلغاء",
      icon: XCircle,
      variant: "outline",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
};

const SELLER_ACTIONS: Record<string, ActionConfig[]> = {
  REQUESTED: [
    {
      key: "approve",
      label: "قبول المرتجع",
      icon: CheckCircle2,
      variant: "success",
      successStatus: "APPROVED",
      confirmTitle: "قبول المرتجع",
      confirmDescription:
        "سيُعلم المشتري بقبول الإرجاع ليبدأ بشحن المنتجات.",
    },
    {
      key: "reject",
      label: "رفض",
      icon: XCircle,
      variant: "danger",
      successStatus: "REJECTED",
      requiresReason: true,
    },
  ],
  APPROVED: [
    {
      key: "cancel",
      label: "إلغاء",
      icon: XCircle,
      variant: "outline",
      successStatus: "CANCELLED",
      requiresReason: true,
    },
  ],
  PENDING_SHIPMENT: [
    {
      key: "receive",
      label: "استلام المنتجات",
      icon: Inbox,
      variant: "primary",
      successStatus: "RECEIVED",
      opensDialog: "receive",
    },
  ],
  RECEIVED: [
    {
      key: "inspect",
      label: "فحص المنتجات",
      icon: ClipboardCheck,
      variant: "primary",
      successStatus: "INSPECTED",
      opensDialog: "inspect",
    },
  ],
  INSPECTED: [
    {
      key: "complete",
      label: "إكمال المرتجع",
      icon: PackageCheck,
      variant: "success",
      successStatus: "COMPLETED",
      confirmTitle: "إكمال المرتجع",
      confirmDescription:
        "سيتم نقل المنتجات المقبولة إلى مخزونك، وإنشاء إشعار دائن، واسترداد المبلغ إن وُجد دفع سابق. لا يمكن التراجع.",
    },
  ],
};

export interface ReturnActionsProps {
  returnId: number;
  currentStatus: string;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  items: ReturnDetail["items"];
  onStatusChange: (status: string) => void;
}

export function ReturnActions({
  returnId,
  currentStatus,
  isBuyer,
  isSeller,
  isAdmin,
  items,
  onStatusChange,
}: ReturnActionsProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [reasonDialog, setReasonDialog] = useState<ActionConfig | null>(null);
  const [reason, setReason] = useState("");
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);

  const buyerActions = isBuyer ? BUYER_ACTIONS[currentStatus] ?? [] : [];
  const sellerActions = isSeller ? SELLER_ACTIONS[currentStatus] ?? [] : [];

  // Merge — prefer seller
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

  if (actions.length === 0 && !isAdmin) return null;
  if (actions.length === 0 && isAdmin) {
    return (
      <Card>
        <p className="text-xs text-gray-500">
          أنت تشاهد المرتجع كأدمن — الإجراءات متاحة للأطراف المعنية فقط.
        </p>
      </Card>
    );
  }

  const execute = async (
    config: ActionConfig,
    body: Record<string, any>
  ) => {
    setActionLoading(config.key);
    try {
      const res = await fetch(
        `/api/wholesale/returns/${returnId}/${config.key}`,
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
      setReasonDialog(null);
      setReason("");
      setReceiveOpen(false);
      setInspectOpen(false);

      // For complete/inspect, refresh to get updated data
      if (
        config.key === "complete" ||
        config.key === "inspect" ||
        config.key === "receive"
      ) {
        router.refresh();
      }
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleClick = (config: ActionConfig) => {
    if (config.opensDialog === "receive") {
      setReceiveOpen(true);
    } else if (config.opensDialog === "inspect") {
      setInspectOpen(true);
    } else if (config.requiresReason) {
      setReasonDialog(config);
      setReason("");
    } else if (config.confirmTitle) {
      setReasonDialog(config);
    } else {
      execute(config, {});
    }
  };

  const handleConfirm = () => {
    if (!reasonDialog) return;
    if (reasonDialog.requiresReason && reason.trim().length < 3) {
      toast("السبب يجب أن يكون 3 أحرف على الأقل", "warning");
      return;
    }
    const body = reasonDialog.requiresReason ? { reason: reason.trim() } : {};
    execute(reasonDialog, body);
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
          كل عملية مسجلة في سجل التدقيق.
        </p>
      </Card>

      <Dialog
        open={!!reasonDialog}
        onClose={() => {
          setReasonDialog(null);
          setReason("");
        }}
        title={reasonDialog?.confirmTitle ?? reasonDialog?.label ?? ""}
        description={reasonDialog?.confirmDescription}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setReasonDialog(null);
                setReason("");
              }}
              disabled={!!actionLoading}
            >
              إلغاء
            </Button>
            <Button
              variant={reasonDialog?.requiresReason ? "danger" : "primary"}
              onClick={handleConfirm}
              loading={!!actionLoading}
            >
              تأكيد
            </Button>
          </>
        }
      >
        {reasonDialog?.requiresReason ? (
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

      <ReceiveItemsDialog
        open={receiveOpen}
        onClose={() => setReceiveOpen(false)}
        items={items}
        onConfirm={async (receiveData) => {
          await execute(
            SELLER_ACTIONS.PENDING_SHIPMENT[0],
            { items: receiveData }
          );
        }}
        loading={actionLoading === "receive"}
      />

      <InspectItemsDialog
        open={inspectOpen}
        onClose={() => setInspectOpen(false)}
        items={items}
        onConfirm={async (inspectData) => {
          await execute(
            SELLER_ACTIONS.RECEIVED[0],
            { items: inspectData }
          );
        }}
        loading={actionLoading === "inspect"}
      />
    </>
  );
}