"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Package, Truck, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<string, any> = {
  ORDER_CREATED: Package,
  ORDER_STATUS_CHANGED: Truck,
  PAYMENT_RECEIVED: CheckCircle2,
  SHIPPING_UPDATED: Truck,
  RETURN_REQUESTED: RotateCcw,
  RETURN_APPROVED: CheckCircle2,
  RETURN_REJECTED: RotateCcw,
};

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  // ═══ تحميل المستخدم + العدد الأولي ═══
  useEffect(() => {
    async function checkUser() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          loadNotifications(true);
        }
      } catch {
        // no session
      }
    }
    checkUser();
  }, []);

  // ═══ Polling كل 60 ثانية لعدّاد الإشعارات ═══
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => loadNotifications(true), 60000);
    return () => clearInterval(interval);
  }, [user]);

  // ═══ إغلاق عند النقر خارج ═══
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadNotifications(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=5");
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // silent
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await loadNotifications();
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch {
      // silent
    }
  }

  async function handleClickNotification(id: number, link: string | null) {
    // mark as read locally
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    if (unreadCount > 0) setUnreadCount((c) => c - 1);

    // fire-and-forget على السيرفر
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});

    // router push يدوياً للرابط (بدون Link لأنه dynamic)
    if (link) {
      window.location.href = link;
    }
  }

  // ═══ إذا لا يوجد مستخدم، لا تُظهر شيئاً ═══
  if (!user) {
    return (
      <div className="flex h-8 w-8 items-center justify-center sm:h-9 sm:w-9">
        <Bell className="h-[18px] w-[18px] text-gray-400" />
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-gray-100 sm:h-9 sm:w-9"
        aria-label="الإشعارات"
      >
        <Bell className="h-[18px] w-[18px] text-[#111827]" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          {/* رأس */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2.5">
            <span className="text-sm font-black">الإشعارات</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-[#ff5c00] hover:underline"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {/* القائمة */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#ff5c00]" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-3xl">🔔</div>
                <p className="mt-2 text-xs text-gray-500">لا توجد إشعارات</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type] || Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClickNotification(notif.id, notif.link)}
                    className={`flex w-full gap-2.5 border-b border-gray-50 px-3 py-3 text-right transition hover:bg-gray-50 ${
                      !notif.isRead ? "bg-orange-50/40" : ""
                    }`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100">
                      <Icon className="h-4 w-4 text-[#ff5c00]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold">{notif.title}</div>
                      <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-gray-500">
                        {notif.message}
                      </div>
                      <div className="mt-1 text-[9px] text-gray-400">
                        {new Date(notif.createdAt).toLocaleDateString("ar-MA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {!notif.isRead && (
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff5c00]" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* عرض الكل */}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-gray-100 bg-gray-50 py-2.5 text-center text-xs font-bold text-[#ff5c00] transition hover:bg-gray-100"
          >
            عرض كل الإشعارات
          </Link>
        </div>
      )}
    </div>
  );
}