"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Package,
  Truck,
  CheckCircle2,
  RotateCcw,
  Loader2,
  ArrowRight,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

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

type Filter = "ALL" | "UNREAD";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      const data = await res.json();

      if (res.status === 401) {
        router.push("/login");
        return;
      }

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
    loadNotifications();
  }, []);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClick(n: Notification) {
    // mark as read locally
    if (!n.isRead) {
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
    }

    if (n.link) {
      router.push(n.link);
    }
  }

  const filtered = notifications.filter((n) => {
    if (filter === "UNREAD" && n.isRead) return false;
    return true;
  });

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">الإشعارات</h1>
            {unreadCount > 0 && (
              <p className="mt-1 text-xs text-[#6b7280]">
                {unreadCount} غير مقروء
              </p>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="rounded-full border border-[#ff5c00] bg-white px-4 py-2 text-xs font-bold text-[#ff5c00] transition hover:bg-[#fff4ed]"
            >
              تحديد الكل كمقروء
            </button>
          )}
        </div>

        {/* الفلاتر */}
        <div className="mb-4 flex gap-2">
          {(["ALL", "UNREAD"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f
                  ? "bg-[#ff5c00] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "ALL" ? "الكل" : "غير المقروءة"}
            </button>
          ))}
        </div>

        {/* القائمة */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <div className="text-5xl">🔔</div>
            <h3 className="mt-4 text-lg font-black">
              {filter === "UNREAD" ? "لا إشعارات غير مقروءة" : "لا توجد إشعارات"}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              ستظهر هنا تحديثات طلباتك
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const Icon = TYPE_ICONS[n.type] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex w-full gap-3 rounded-xl border border-gray-100 p-4 text-right shadow-sm transition hover:shadow-md ${
                    !n.isRead ? "bg-orange-50/40" : "bg-white"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                    <Icon className="h-5 w-5 text-[#ff5c00]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold">{n.title}</span>
                      {!n.isRead && (
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ff5c00]" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-6 text-gray-600">
                      {n.message}
                    </p>
                    <div className="mt-1.5 text-[10px] text-gray-400">
                      {new Date(n.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>

                  <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-gray-300" />
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-[#111827] transition hover:bg-gray-50"
          >
            <ArrowRight className="h-4 w-4" />
            عودة للتسوق
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}