"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  LogOut,
  LayoutDashboard,
  ChevronDown,
  Package,
  Gift,
} from "lucide-react";

type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type UserMenuProps = {
  compact?: boolean;
};

export default function UserMenu({ compact = false }: UserMenuProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) setUser(data.user);
      } catch {
        // no session
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("nokhba:auth-changed"));
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center rounded-full transition-all duration-300 ${
          compact ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9"
        }`}
      >
        <div
          className={`animate-spin rounded-full border-2 border-gray-300 border-t-[#ff5c00] transition-all duration-300 ${
            compact ? "h-3.5 w-3.5" : "h-4 w-4"
          }`}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={`flex items-center justify-center rounded-full border border-black/10 bg-white font-bold text-[#111827] transition-all duration-300 hover:border-[#ff5c00] hover:text-[#ff5c00] ${
          compact
            ? "h-7 px-2 text-[10px]"
            : "h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm"
        }`}
      >
        دخول
      </Link>
    );
  }

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full border border-black/10 bg-white transition-all duration-300 hover:border-[#ff5c00] ${
          compact ? "px-1 py-0.5" : "px-2 py-1.5 sm:px-2.5"
        }`}
        aria-label="القائمة"
      >
        <div
          className={`flex items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-500 font-black text-white transition-all duration-300 ${
            compact ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]"
          }`}
        >
          {firstName.charAt(0)}
        </div>
        <span
          className={`hidden font-bold text-[#111827] transition-all duration-300 lg:inline ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          {firstName}
        </span>
        <ChevronDown
          className={`hidden text-gray-400 transition-all duration-300 lg:inline ${
            compact ? "h-2.5 w-2.5" : "h-3 w-3"
          } ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="fixed left-2 top-[5.5rem] z-[70] w-[230px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl md:right-auto md:left-4 md:top-[4.25rem] md:w-[340px] md:max-w-[calc(100vw-2rem)]">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="text-xs font-bold text-gray-900">{user.name}</div>
            <div className="mt-0.5 truncate text-[10px] text-gray-500">
              {user.email}
            </div>
            {isAdmin && (
              <span className="mt-1.5 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700">
                {user.role === "SUPER_ADMIN" ? "مدير عام" : "مدير"}
              </span>
            )}
          </div>

          <div className="p-1">
            <Link
              href="/orders"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
            >
              <Package className="h-3.5 w-3.5" />
              طلباتي
            </Link>

            <Link
              href="/loyalty"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
            >
              <Gift className="h-3.5 w-3.5 text-[#ff5c00]" />
              <span>نقاط الولاء</span>
              <span className="mr-auto rounded-full bg-[#fff4ed] px-1.5 py-0.5 text-[9px] font-black text-[#ff5c00]">
                🎁
              </span>
            </Link>

            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
            >
              <User className="h-3.5 w-3.5" />
              حسابي
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 transition hover:bg-purple-50"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                لوحة التحكم
              </Link>
            )}

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              {loggingOut ? "جارٍ الخروج..." : "تسجيل الخروج"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}