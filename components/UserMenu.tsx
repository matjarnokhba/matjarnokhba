"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, LogOut, LayoutDashboard, ChevronDown, Package } from "lucide-react";

type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ═══════ تحميل الجلسة ═══════
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success) setUser(data.user);
      } catch {
        // لا جلسة
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  // ═══════ إغلاق عند النقر خارج القائمة ═══════
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ═══════ تسجيل الخروج ═══════
  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingOut(false);
    }
  }

  // ═══════ تحميل ═══════
  if (loading) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#ff5c00]"></div>
      </div>
    );
  }

  // ═══════ زائر ═══════
  if (!user) {
    return (
      <Link
        href="/login"
        className="flex h-8 items-center justify-center rounded-full border border-black/10 bg-white px-3 text-xs font-bold text-[#111827] transition hover:border-[#ff5c00] hover:text-[#ff5c00] sm:h-9 sm:px-4 sm:text-sm"
      >
        دخول
      </Link>
    );
  }

  // ═══════ مستخدم مسجل ═══════
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const firstName = user.name.split(" ")[0];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ═══ زر الحساب ═══ */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1.5 transition hover:border-[#ff5c00] sm:px-2.5"
        aria-label="القائمة"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-500 text-[10px] font-black text-white">
          {firstName.charAt(0)}
        </div>
        <span className="hidden text-xs font-bold text-[#111827] lg:inline">
          {firstName}
        </span>
        <ChevronDown
          className={`hidden h-3 w-3 text-gray-400 transition lg:inline ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ═══ القائمة المنسدلة ═══ */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          {/* معلومات المستخدم */}
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

          {/* خيارات */}
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