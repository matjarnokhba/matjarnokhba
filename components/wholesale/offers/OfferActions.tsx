"use client";

import { useState } from "react";
import {
  Send,
  Pause,
  Play,
  Archive,
  ShieldCheck,
  ShieldX,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/lib/hooks/useToast";

export interface OfferActionsProps {
  offerId: number;
  currentStatus: string;
  isAdmin: boolean;
  isOwner: boolean;
  onStatusChange: (status: string) => void;
}

type ActionKey =
  | "submit"
  | "pause"
  | "resume"
  | "archive"
  | "approve"
  | "reject"
  | "suspend"
  | "restore";

const ACTION_ENDPOINTS: Record<ActionKey, string> = {
  submit: "submit",
  pause: "pause",
  resume: "resume",
  archive: "archive",
  approve: "approve",
  reject: "reject",
  suspend: "suspend",
  restore: "restore",
};

const OWNER_ACTIONS: Record<
  string,
  Array<{ key: ActionKey; label: string; variant: "primary" | "secondary" | "danger" | "outline"; icon: typeof Send }>
> = {
  DRAFT: [
    { key: "submit", label: "إرسال للمراجعة", variant: "primary", icon: Send },
    { key: "archive", label: "أرشفة", variant: "outline", icon: Archive },
  ],
  REJECTED: [
    { key: "submit", label: "إعادة الإرسال", variant: "primary", icon: Send },
  ],
  ACTIVE: [
    { key: "pause", label: "إيقاف مؤقت", variant: "outline", icon: Pause },
    { key: "archive", label: "أرشفة", variant: "outline", icon: Archive },
  ],
  PAUSED: [
    { key: "resume", label: "استئناف", variant: "primary", icon: Play },
    { key: "archive", label: "أرشفة", variant: "outline", icon: Archive },
  ],
  PENDING_REVIEW: [],
  SUSPENDED: [],
  ARCHIVED: [],
  OUT_OF_STOCK: [
    { key: "pause", label: "إيقاف", variant: "outline", icon: Pause },
  ],
};

const ADMIN_ACTIONS: Record<
  string,
  Array<{ key: ActionKey; label: string; variant: "primary" | "secondary" | "danger" | "outline" | "success"; icon: typeof Send }>
> = {
  PENDING_REVIEW: [
    { key: "approve", label: "اعتماد", variant: "success", icon: CheckCircle2 },
    { key: "reject", label: "رفض", variant: "danger", icon: XCircle },
  ],
  REJECTED: [
    { key: "approve", label: "اعتماد", variant: "success", icon: CheckCircle2 },
  ],
  ACTIVE: [
    { key: "suspend", label: "إيقاف إداريًا", variant: "danger", icon: ShieldX },
  ],
  SUSPENDED: [
    { key: "restore", label: "استعادة", variant: "primary", icon: ShieldCheck },
  ],
};

export function OfferActions({
  offerId,
  currentStatus,
  isAdmin,
  isOwner,
  onStatusChange,
}: OfferActionsProps) {
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null);
  const [reasonDialog, setReasonDialog] = useState<{
    key: ActionKey;
    title: string;
    description: string;
    requiresReason: boolean;
    successStatus: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  const ownerActions = isOwner ? OWNER_ACTIONS[currentStatus] ?? [] : [];
  const adminActions = isAdmin ? ADMIN_ACTIONS[currentStatus] ?? [] : [];

  if (ownerActions.length === 0 && adminActions.length === 0) {
    return null;
  }

  const executeAction = async (
    key: ActionKey,
    body: Record<string, any>,
    successStatus?: string
  ) => {
    setActionLoading(key);
    try {
      const isAdminAction = ["approve", "reject", "suspend", "restore"].includes(
        key
      );
      const base = isAdminAction
        ? `/api/admin/wholesale/offers/${offerId}`
        : `/api/wholesale/offers/${offerId}`;
      const url = `${base}/${ACTION_ENDPOINTS[key]}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل تنفيذ العملية", "error");
        return;
      }

      toast("تم تنفيذ العملية بنجاح", "success");
      if (successStatus) onStatusChange(successStatus);
      setReasonDialog(null);
      setReason("");
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = (key: ActionKey) => {
    // Actions that need confirmation/reason
    switch (key) {
      case "reject":
        setReasonDialog({
          key,
          title: "رفض العرض",
          description: "اذكر سبب رفض هذا العرض — سيظهر للتاجر.",
          requiresReason: true,
          successStatus: "REJECTED",
        });
        break;
      case "suspend":
        setReasonDialog({
          key,
          title: "إيقاف العرض إداريًا",
          description: "اذكر سبب الإيقاف — سيظهر للتاجر.",
          requiresReason: true,
          successStatus: "SUSPENDED",
        });
        break;
      case "archive":
        setReasonDialog({
          key,
          title: "أرشفة العرض",
          description:
            "سيتم نقل العرض للأرشيف. لا يمكن التراجع — لكن يمكن إنشاء عرض جديد لاحقًا.",
          requiresReason: false,
          successStatus: "ARCHIVED",
        });
        break;
      default:
        // Direct execution
        const successMap: Record<ActionKey, string> = {
          submit: "PENDING_REVIEW",
          pause: "PAUSED",
          resume: "ACTIVE",
          approve: "ACTIVE",
          restore: "ACTIVE",
          archive: "ARCHIVED",
          reject: "REJECTED",
          suspend: "SUSPENDED",
        };
        executeAction(key, {}, successMap[key]);
    }
  };

  const handleDialogConfirm = () => {
    if (!reasonDialog) return;
    const body = reasonDialog.requiresReason
      ? { reason: reason.trim() }
      : {};
    if (reasonDialog.requiresReason && reason.trim().length < 3) {
      toast("السبب يجب أن يكون 3 أحرف على الأقل", "warning");
      return;
    }
    executeAction(reasonDialog.key, body, reasonDialog.successStatus);
  };

  return (
    <>
      <Card>
        <h3 className="mb-3 text-sm font-bold text-gray-900">إجراءات</h3>
        <div className="space-y-2">
          {ownerActions.length > 0 && (
            <>
              {ownerActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Button
                    key={a.key}
                    variant={a.variant}
                    fullWidth
                    loading={actionLoading === a.key}
                    onClick={() => handleAction(a.key)}
                    iconLeft={
                      actionLoading !== a.key ? <Icon className="h-4 w-4" /> : undefined
                    }
                  >
                    {a.label}
                  </Button>
                );
              })}
            </>
          )}
          {adminActions.length > 0 && (
            <>
              {ownerActions.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="mb-2 text-xs font-medium text-gray-500">
                    إجراءات الأدمن
                  </p>
                </div>
              )}
              {adminActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Button
                    key={a.key}
                    variant={a.variant}
                    fullWidth
                    loading={actionLoading === a.key}
                    onClick={() => handleAction(a.key)}
                    iconLeft={
                      actionLoading !== a.key ? <Icon className="h-4 w-4" /> : undefined
                    }
                  >
                    {a.label}
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </Card>

      <Dialog
        open={!!reasonDialog}
        onClose={() => {
          setReasonDialog(null);
          setReason("");
        }}
        title={reasonDialog?.title ?? ""}
        description={reasonDialog?.description}
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
              variant={reasonDialog?.key === "reject" || reasonDialog?.key === "suspend" ? "danger" : "primary"}
              onClick={handleDialogConfirm}
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
            maxLength={500}
            rows={3}
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