"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export default function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch("/api/auth/me");
        const data = await response.json();
        if (data.success) setUser(data.user);
      } catch (err) {
        // لا جلسة
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-[#c69b5e]"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-bold text-[#1b1c1a] transition hover:border-[#c69b5e] hover:text-[#b17f3f]"
      >
        دخول
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm font-bold text-[#1b1c1a] sm:inline">
        مرحباً، <span className="text-[#b17f3f]">{user.name.split(" ")[0]}</span>
      </span>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-xs font-bold text-[#77736a] transition hover:border-[#c69b5e] hover:text-[#b17f3f] disabled:opacity-50"
      >
        {loggingOut ? "..." : "خروج"}
      </button>
    </div>
  );
}