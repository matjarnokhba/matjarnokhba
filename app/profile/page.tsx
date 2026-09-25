"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Mail,
  Phone,
  Loader2,
  Save,
  Package,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

type UserData = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/profile");
        const data = await res.json();

        if (!res.ok || !data.success) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          setError(data.message || "فشل التحميل");
          return;
        }

        setUser(data.user);
        setName(data.user.name);
        setPhone(data.user.phone || "");
      } catch {
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim() || name.trim().length < 2) {
      setError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }

      setUser(data.user);
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={0}
          onCartClick={() => {}}
        />
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
        </div>
        <Footer />
      </main>
    );
  }

  if (!user) return null;

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      <div className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-5 text-2xl font-black">حسابي</h1>

        {/* ═══════ بطاقة المستخدم ═══════ */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 p-5 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-black backdrop-blur">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-black">{user.name}</div>
              <div className="mt-0.5 truncate text-xs text-white/80">
                {user.email}
              </div>
              {isAdmin && (
                <span className="mt-1.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
                  {user.role === "SUPER_ADMIN" ? "مدير عام" : "مدير"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ═══════ روابط سريعة ═══════ */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/orders"
            className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition hover:shadow-md"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff4ed]">
              <Package className="h-5 w-5 text-[#ff5c00]" />
            </div>
            <div>
              <div className="text-sm font-bold">طلباتي</div>
              <div className="text-[10px] text-[#6b7280]">عرض الطلبات</div>
            </div>
          </Link>

          {isAdmin ? (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <ShieldCheck className="h-5 w-5 text-purple-700" />
              </div>
              <div>
                <div className="text-sm font-bold">لوحة التحكم</div>
                <div className="text-[10px] text-[#6b7280]">إدارة المتجر</div>
              </div>
            </Link>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-xl bg-white p-3 text-right shadow-sm transition hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <LogOut className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-sm font-bold">تسجيل الخروج</div>
                <div className="text-[10px] text-[#6b7280]">خروج</div>
              </div>
            </button>
          )}
        </div>

        {/* ═══════ البيانات الشخصية ═══════ */}
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-2xl bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-base font-black">البيانات الشخصية</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 py-2.5 pr-10 pl-3 text-sm text-gray-500 outline-none"
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-400">
                لا يمكن تغيير البريد الإلكتروني حالياً
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                رقم الهاتف
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0612345678"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              ✓ تم حفظ التغييرات بنجاح
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-5 flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ التغييرات
          </button>
        </form>

        {/* ═══════ زر خروج إضافي (للمدير) ═══════ */}
        {isAdmin && (
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
        )}
      </div>

      <Footer />
    </main>
  );
}