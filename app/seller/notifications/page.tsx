"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Bell,
  Search,
  Package,
  ShoppingCart,
  Settings,
  AlertTriangle,
  Info,
  X,
  Check,
  ExternalLink,
  Star,
} from "lucide-react";

type Notification = {
  id: number;
  type: string;
  title: string;
  message: string;
  link: string | null;
  metadata: any;
  category: string | null;
  severity: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

const CATEGORY_INFO: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  PRODUCT: { label: "منتجات", icon: Package, color: "text-purple-600" },
  ORDER: { label: "طلبات", icon: ShoppingCart, color: "text-orange-600" },
  SYSTEM: { label: "نظام", icon: Settings, color: "text-gray-600" },
};

const SEVERITY_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  INFO: {
    label: "معلومة",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: Info,
  },
  WARNING: {
    label: "تحذير",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: AlertTriangle,
  },
};

type FilterType = "ALL" | "UNREAD" | "READ";

export default function SellerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("filter", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(
        `/api/seller/notifications?${params.toString()}`
      );
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") loadData();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleOpen(notif: Notification) {
    setSelected(notif);
    if (!notif.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/seller/notifications/${notif.id}`, {
        method: "PATCH",
      }).catch(() => {});
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/seller/notifications/read-all", {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">الإشعارات</h1>
          <p className="mt-1 text-sm text-gray-500">
            كل تحركات متجرك
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                {unreadCount} جديد
              </span>
            )}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            تحديد الكل كمقروء
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في الإشعارات..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["ALL", "UNREAD", "READ"] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "ALL" && "الكل"}
            {f === "UNREAD" && "غير المقروءة"}
            {f === "READ" && "المقروءة"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد إشعارات</h3>
          <p className="mt-2 text-sm text-gray-500">
            ستظهر هنا تحديثات طلباتك ومنتجاتك
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const catInfo = notif.category
              ? CATEGORY_INFO[notif.category]
              : null;
            const sevInfo =
              SEVERITY_INFO[notif.severity || "INFO"] || SEVERITY_INFO.INFO;
            const SevIcon = sevInfo.icon;
            const CatIcon = catInfo?.icon || Bell;

            return (
              <button
                key={notif.id}
                onClick={() => handleOpen(notif)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-right shadow-sm transition hover:shadow-md ${
                  !notif.isRead
                    ? "border-orange-200 bg-orange-50/50"
                    : "border-gray-100 bg-white"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    catInfo?.color || "text-gray-600"
                  } ${sevInfo.bg}`}
                >
                  <CatIcon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-gray-900">
                      {notif.title}
                    </span>
                    {!notif.isRead && (
                      <span className="h-2 w-2 rounded-full bg-[#ff5c00]" />
                    )}
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                    {notif.message}
                  </p>

                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-400">
                    {catInfo && <span>{catInfo.label}</span>}
                    <span>·</span>
                    <span>
                      {new Date(notif.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <ExternalLink className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h3 className="text-lg font-black">تفاصيل الإشعار</h3>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <h4 className="text-lg font-black text-gray-900">
                {selected.title}
              </h4>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm leading-7 text-gray-700">
                  {selected.message}
                </p>
              </div>

              <div className="text-xs text-gray-400">
                {new Date(selected.createdAt).toLocaleString("ar-MA")}
              </div>

              {selected.link && (
                <Link
                  href={selected.link}
                  onClick={() => setSelected(null)}
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
                >
                  <ExternalLink className="h-4 w-4" />
                  فتح الصفحة المرتبطة
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}