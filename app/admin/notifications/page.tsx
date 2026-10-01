"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Bell,
  Search,
  Package,
  Store,
  ShoppingCart,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Check,
  ExternalLink,
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

type CategoryCounts = {
  PRODUCT: number;
  SELLER: number;
  ORDER: number;
  SYSTEM: number;
};

const CATEGORY_INFO: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  PRODUCT: { label: "منتجات", icon: Package, color: "text-purple-600" },
  SELLER: { label: "تجار", icon: Store, color: "text-blue-600" },
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
  CRITICAL: {
    label: "حرج",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: AlertTriangle,
  },
};

type CategoryFilter = "ALL" | "PRODUCT" | "SELLER" | "ORDER" | "SYSTEM";
type FilterType = "ALL" | "UNREAD" | "READ";

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCounts>({
    PRODUCT: 0,
    SELLER: 0,
    ORDER: 0,
    SYSTEM: 0,
  });
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (filter !== "ALL") params.set("filter", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setCategoryCounts(data.categoryCounts);
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
  }, [category, filter]);

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
      // علّم محلياً
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      // أرسل للـAPI
      fetch(`/api/admin/notifications/${notif.id}`, {
        method: "PATCH",
      }).catch(() => {});
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/admin/notifications/read-all", {
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
          <h1 className="text-2xl font-black text-gray-900">
            إشعارات النظام
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            متابعة كل تحركات التجار والمنتجات
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

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          ["PRODUCT", "SELLER", "ORDER", "SYSTEM"] as const
        ).map((cat) => {
          const info = CATEGORY_INFO[cat];
          const Icon = info.icon;
          return (
            <button
              key={cat}
              onClick={() =>
                setCategory(category === cat ? "ALL" : (cat as CategoryFilter))
              }
              className={`rounded-xl border p-4 text-right shadow-sm transition ${
                category === cat
                  ? "border-[#ff5c00] bg-[#fff4ed]"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`h-5 w-5 ${info.color}`} />
                <span className="text-xl font-black text-gray-900">
                  {categoryCounts[cat]}
                </span>
              </div>
              <div className="mt-1 text-xs font-bold text-gray-600">
                {info.label}
              </div>
            </button>
          );
        })}
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
        {category !== "ALL" && (
          <button
            onClick={() => setCategory("ALL")}
            className="flex items-center gap-1 rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700"
          >
            <X className="h-3 w-3" />
            {CATEGORY_INFO[category].label}
          </button>
        )}
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
            ستظهر هنا كل تحركات التجار
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
                {/* أيقونة التصنيف */}
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
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${sevInfo.bg} ${sevInfo.color}`}
                    >
                      <SevIcon className="h-2.5 w-2.5" />
                      {sevInfo.label}
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

      {/* ═══ Modal التفاصيل ═══ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس */}
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h3 className="text-lg font-black">تفاصيل الإشعار</h3>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* محتوى */}
            <div className="space-y-4 p-5">
              {/* العنوان + النوع */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-lg font-black text-gray-900">
                    {selected.title}
                  </h4>
                  {selected.severity && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        SEVERITY_INFO[selected.severity]?.bg
                      } ${SEVERITY_INFO[selected.severity]?.color}`}
                    >
                      {SEVERITY_INFO[selected.severity]?.label}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {new Date(selected.createdAt).toLocaleString("ar-MA")}
                </div>
              </div>

              {/* الرسالة */}
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm leading-7 text-gray-700">
                  {selected.message}
                </p>
              </div>

              {/* Metadata — جدول التغييرات */}
              {selected.metadata?.changes &&
                Array.isArray(selected.metadata.changes) && (
                  <div>
                    <h5 className="mb-2 text-sm font-black">
                      التغييرات ({selected.metadata.changes.length})
                    </h5>
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-3 py-2 text-right font-bold">
                              الحقل
                            </th>
                            <th className="px-3 py-2 text-right font-bold">
                              القيمة القديمة
                            </th>
                            <th className="px-3 py-2 text-right font-bold">
                              القيمة الجديدة
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.metadata.changes.map(
                            (change: any, idx: number) => (
                              <tr key={idx} className="border-t border-gray-100">
                                <td className="px-3 py-2 font-bold">
                                  {change.field}
                                  {change.sensitive && " ⚠️"}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {formatValue(change.oldValue)}
                                </td>
                                <td className="px-3 py-2 font-bold text-gray-900">
                                  {formatValue(change.newValue)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              {/* معلومات إضافية */}
              {selected.metadata?.priceWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{selected.metadata.priceWarning}</span>
                </div>
              )}

              {/* رابط */}
              {selected.link && (
                <Link
                  href={selected.link}
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

// ═══ تنسيق القيم ═══
function formatValue(value: any): React.ReactNode {
  if (value === null || value === undefined)
    return <span className="text-gray-400">—</span>;
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") {
    if (value.startsWith("http")) {
      return (
        <img
          src={value}
          alt=""
          className="h-10 w-10 rounded object-cover"
        />
      );
    }
    return value.length > 50 ? value.slice(0, 50) + "..." : value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string" && value[0].startsWith("http")) {
      return (
        <div className="flex gap-1">
          {value.slice(0, 3).map((url: string, i: number) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-10 w-10 rounded object-cover"
            />
          ))}
          {value.length > 3 && (
            <span className="text-gray-400">+{value.length - 3}</span>
          )}
        </div>
      );
    }
    return value.join(", ");
  }
  return JSON.stringify(value);
}