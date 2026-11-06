"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Loader2,
  Package,
  Tag,
  ShoppingCart,
  RotateCcw,
  Building2,
  Info,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/ui/cn";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  category: string | null;
  severity: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

type FilterTab = "all" | "unread";

const WHOLESALE_TYPE_PREFIX = "WHOLESALE_";

const TYPE_ICON: Record<string, typeof Package> = {
  WHOLESALE_MASTER_APPROVED: Package,
  WHOLESALE_MASTER_REJECTED: Package,
  WHOLESALE_OFFER_APPROVED: Tag,
  WHOLESALE_OFFER_REJECTED: Tag,
  WHOLESALE_BU_VERIFIED: Building2,
  WHOLESALE_BU_REJECTED: Building2,
  WHOLESALE_ORDER_RECEIVED: ShoppingCart,
  WHOLESALE_ORDER_CONFIRMED: ShoppingCart,
  WHOLESALE_ORDER_SHIPPED: ShoppingCart,
  WHOLESALE_ORDER_DELIVERED: ShoppingCart,
  WHOLESALE_ORDER_CANCELLED: ShoppingCart,
  WHOLESALE_RETURN_REQUESTED: RotateCcw,
  WHOLESALE_RETURN_APPROVED: RotateCcw,
  WHOLESALE_RETURN_REJECTED: RotateCcw,
  WHOLESALE_RETURN_COMPLETED: RotateCcw,
};

const SEVERITY_STYLE: Record<
  string,
  { icon: typeof Info; iconClass: string; bg: string; border: string }
> = {
  INFO: {
    icon: Info,
    iconClass: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  SUCCESS: {
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  WARNING: {
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  ERROR: {
    icon: AlertCircle,
    iconClass: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

function isWholesale(n: Notification): boolean {
  return (
    (n.category ?? "").toUpperCase() === "WHOLESALE" ||
    n.type.startsWith(WHOLESALE_TYPE_PREFIX)
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "الآن";
    if (minutes < 60) return `قبل ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `قبل ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `قبل ${days} يوم`;
    return d.toLocaleDateString("ar-MA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function NotificationsContent() {
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?limit=50");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل تحميل الإشعارات");
        return;
      }
      const all: Notification[] = data.notifications ?? [];
      const wholesale = all.filter(isWholesale);
      setNotifications(wholesale);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unread = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );

  const visible = useMemo(() => {
    if (tab === "unread") return unread;
    return notifications;
  }, [notifications, unread, tab]);

  const handleMarkAllRead = async () => {
    if (markingAll || unread.length === 0) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل تعليم الكل كمقروء", "error");
        return;
      }
      // Optimistic
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      toast("تم تعليم الكل كمقروء", "success");
    } catch {
      toast("خطأ في الاتصال", "error");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = async (n: Notification) => {
    // Mark read optimistically
    if (!n.isRead) {
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, isRead: true, readAt: new Date().toISOString() }
            : x
        )
      );
      try {
        await fetch(`/api/notifications/${n.id}`, {
          method: "PATCH",
        });
      } catch {
        // Silent fail — we still navigate
      }
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإشعارات"
        description={
          unread.length > 0
            ? `${unread.length} إشعار غير مقروء`
            : "لا توجد إشعارات غير مقروءة"
        }
        action={
          unread.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              loading={markingAll}
              iconLeft={!markingAll ? <CheckCheck className="h-4 w-4" /> : undefined}
            >
              تعليم الكل كمقروء
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "all"
              ? "border-[#ff5c00] text-[#ff5c00]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          <Bell className="h-4 w-4" />
          الكل ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("unread")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "unread"
              ? "border-[#ff5c00] text-[#ff5c00]"
              : "border-transparent text-gray-500 hover:text-gray-900"
          )}
        >
          <Inbox className="h-4 w-4" />
          غير المقروءة ({unread.length})
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {error && !loading && (
        <Card>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={load}
              className="mr-2 font-medium underline"
            >
              إعادة المحاولة
            </button>
          </div>
        </Card>
      )}

      {!loading && !error && visible.length === 0 && (
        <Empty
          icon={Bell}
          title={tab === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
          description="ستظهر هنا إشعارات الجملة (منتجات معتمدة، عروض، طلبات، مرتجعات)."
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="space-y-2">
          {visible.map((n) => {
            const TypeIcon = TYPE_ICON[n.type] ?? Bell;
            const sev = SEVERITY_STYLE[n.severity ?? "INFO"] ?? SEVERITY_STYLE.INFO;
            const SevIcon = sev.icon;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full rounded-xl border bg-white p-4 text-right transition-shadow hover:shadow-md",
                  !n.isRead ? "border-[#ff5c00]/30 bg-orange-50/30" : "border-gray-200"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                      sev.bg
                    )}
                  >
                    <TypeIcon className={cn("h-5 w-5", sev.iconClass)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-semibold text-gray-900">
                          {n.title}
                          {!n.isRead && (
                            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#ff5c00]" />
                          )}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">{n.message}</p>
                      </div>
                      {n.link && (
                        <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <SevIcon className={cn("h-3 w-3", sev.iconClass)} />
                        {formatRelativeTime(n.createdAt)}
                      </span>
                      <Badge variant="gray" size="sm">
                        جملة
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}