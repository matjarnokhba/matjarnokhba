"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Store,
  Package,
  FileText,
  Building2,
  Wallet,
  AlertTriangle,
  Banknote,
  Loader2,
  ShoppingCart,
  PackageCheck,
  RotateCcw,
  PackageX,
  Menu,
} from "lucide-react";

type Notif = {
  id: number;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
};

export type TopBarItem = {
  countKey: string;
  label: string;
  href: string;
  icon:
    | "sellers"
    | "products"
    | "documents"
    | "banks"
    | "withdrawals"
    | "legal"
    | "handover"
    | "orders"
    | "fulfillments"
    | "returns"
    | "batches";
};

const ICON_MAP = {
  sellers: Store,
  products: Package,
  documents: FileText,
  banks: Building2,
  withdrawals: Wallet,
  legal: AlertTriangle,
  handover: Banknote,
  orders: ShoppingCart,
  fulfillments: PackageCheck,
  returns: RotateCcw,
  batches: PackageX,
} as const;

type Props = {
  endpointUrl: string;
  readAllUrl: string;
  allNotifsHref: string;
  items: TopBarItem[];
};

export default function RoleTopBar({
  endpointUrl,
  readAllUrl,
  allNotifsHref,
  items,
}: Props) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [openNotifs, setOpenNotifs] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [marking, setMarking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    right: number;
    width: number;
  }>({ top: 64, right: 16, width: 360 });
  const bellRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchCounts(silent = true) {
    if (!silent) setLoadingNotifs(true);
    try {
      const res = await fetch(endpointUrl, { cache: "no-store" });
      const data = await res.json();
      if (data.success) {
        setCounts(data.counts || {});
        setNotifs(data.notificationsList || []);
      }
    } catch {
      // silent
    } finally {
      if (!silent) setLoadingNotifs(false);
    }
  }

  async function markAllRead() {
    setMarking(true);
    try {
      await fetch(readAllUrl, { method: "POST" });
      setNotifs([]);
      setCounts((c) => ({ ...c, notifications: 0 }));
    } catch {}
    setMarking(false);
  }

  async function handleNotifClick(n: Notif) {
    try {
      const notifBase = endpointUrl.replace(/\/topbar\/?$/, "/notifications");
      await fetch(`${notifBase}/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
    } catch {}
    setNotifs((prev) => prev.filter((x) => x.id !== n.id));
    setCounts((c) => ({
      ...c,
      notifications: Math.max(0, (c.notifications || 0) - 1),
    }));
    setOpenNotifs(false);
    if (n.link) router.push(n.link);
  }

  function handleOpen() {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const padding = 8;
      const isMobile = window.innerWidth < 768;
      // عرض أقل على الجوال
      const maxWidth = isMobile ? 260 : 360;
      const width = Math.min(maxWidth, window.innerWidth - padding * 2);
      let right = window.innerWidth - rect.right;
      if (right + width > window.innerWidth - padding) {
        right = window.innerWidth - width - padding;
      }
      if (right < padding) right = padding;
      setDropdownPos({ top: rect.bottom + 8, right, width });
    }
    const next = !openNotifs;
    setOpenNotifs(next);
    if (next) fetchCounts(false);
  }

  useEffect(() => {
    fetchCounts(true);
    const interval = setInterval(() => fetchCounts(true), 45000);
    const onFocus = () => fetchCounts(true);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        bellRef.current &&
        !bellRef.current.contains(e.target as Node) &&
        !(e.target as Element)?.closest?.("[data-notif-dropdown]")
      ) {
        setOpenNotifs(false);
      }
    }
    if (openNotifs) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openNotifs]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenNotifs(false);
    }
    if (openNotifs) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [openNotifs]);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 lg:right-64 z-30 flex h-14 items-center gap-1 border-b border-gray-200 bg-white px-3 shadow-sm"
        dir="rtl"
      >
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("openSidebar"))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 lg:hidden"
          aria-label="القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          ref={bellRef}
          type="button"
          onClick={handleOpen}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-gray-100"
          aria-label="الإشعارات"
        >
          <Bell className="h-5 w-5 text-[#111827]" />
          {(counts.notifications || 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white shadow">
              {counts.notifications > 9 ? "9+" : counts.notifications}
            </span>
          )}
        </button>

        <div className="mx-1 h-6 w-px shrink-0 bg-gray-200" />

        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {items.map((item) => {
            const count = counts[item.countKey] || 0;
            const Icon = ICON_MAP[item.icon];
            return (
              <Link
                key={item.countKey}
                href={item.href}
                title={item.label}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-700 transition hover:bg-gray-100"
              >
                <Icon className="h-5 w-5" />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-black text-white shadow">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </header>

      {mounted &&
        openNotifs &&
        createPortal(
          <div
            data-notif-dropdown
            dir="rtl"
            style={{
              position: "fixed",
              top: `${dropdownPos.top}px`,
              right: `${dropdownPos.right}px`,
              width: `${dropdownPos.width}px`,
              // تم زيادة الطول هنا
              maxHeight: "calc(100vh - 80px)",
              zIndex: 9999,
            }}
            className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2.5">
              <span className="text-sm font-black">الإشعارات</span>
              {(counts.notifications || 0) > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={marking}
                  className="text-[10px] font-bold text-[#ff5c00] hover:underline disabled:opacity-50"
                >
                  {marking ? "..." : "تحديد الكل كمقروء"}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingNotifs ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#ff5c00]" />
                </div>
              ) : notifs.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="text-3xl">🔔</div>
                  <p className="mt-2 text-xs text-gray-500">
                    لا توجد إشعارات
                  </p>
                </div>
              ) : (
                notifs.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotifClick(notif)}
                    className="flex w-full gap-2.5 border-b border-gray-50 bg-orange-50/40 px-3 py-3 text-right transition hover:bg-gray-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100">
                      <Bell className="h-4 w-4 text-[#ff5c00]" />
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
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff5c00]" />
                  </button>
                ))
              )}
            </div>

            <Link
              href={allNotifsHref}
              onClick={() => setOpenNotifs(false)}
              className="block border-t border-gray-100 bg-gray-50 py-2.5 text-center text-xs font-bold text-[#ff5c00] transition hover:bg-gray-100"
            >
              عرض كل الإشعارات
            </Link>
          </div>,
          document.body
        )}
    </>
  );
}