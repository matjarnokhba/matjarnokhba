"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, User, Phone, Mail, Check } from "lucide-react";

export default function EditProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!data.success) {
          router.push("/login");
          return;
        }
        setUser(data.user);
        setName(data.user.name);
        setPhone(data.user.phone || "");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!name.trim() || name.trim().length < 2) {
      setError("الاسم مطلوب (2 أحرف على الأقل)");
      return;
    }

    if (phone && !/^0[567]\d{8}$/.test(phone.replace(/\s|-/g, ""))) {
      setError("رقم الهاتف المغربي غير صحيح");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }

      setSuccess(true);
      window.dispatchEvent(new CustomEvent("nokhba:auth-changed"));
      setTimeout(() => router.push("/profile"), 1200);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع
      </Link>

      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="mb-6 text-xl font-black">تعديل الملف الشخصي</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
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
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
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
                  value={user?.email || ""}
                  disabled
                  dir="ltr"
                  className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 py-2.5 pr-10 pl-3 text-sm text-gray-500"
                />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                لا يمكن تغيير البريد الإلكتروني
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                <Check className="h-4 w-4" />
                تم الحفظ بنجاح
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}