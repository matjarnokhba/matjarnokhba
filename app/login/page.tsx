"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ═══════════════════════════════════════════
// Redirect by role
// ═══════════════════════════════════════════
function getDashboardPath(role: string): string {
  switch (role) {
    case "SELLER":
      return "/seller";
    case "ADMIN":
    case "SUPER_ADMIN":
      return "/admin";
    case "WAREHOUSE_MANAGER":
      return "/warehouse";
    case "COLLECTOR":
      return "/collector";
    case "DELIVERY":
      return "/delivery";
    default:
      return "/";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || "حدث خطأ");
        setLoading(false);
        return;
      }

      // ⭐ إخبار جميع Providers بتغيير الحساب
      window.dispatchEvent(new CustomEvent("nokhba:auth-changed"));

      // ⭐ Redirect حسب الدور
      const role = data.user?.role || "CUSTOMER";
      const target = getDashboardPath(role);

      router.push(target);
      router.refresh();
    } catch (err) {
      setError("حدث خطأ في الاتصال");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          تسجيل الدخول
        </h1>
        <p className="text-center text-gray-500 mb-8">
          مرحباً بك في متجر نخبة
        </p>

        {verified === "true" && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-4">
            ✅ تم تأكيد بريدك الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.
          </div>
        )}
        {authError === "invalid_token" && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
            ❌ رابط التأكيد غير صالح أو منتهي الصلاحية.
          </div>
        )}
        {authError === "google_auth_failed" && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
            ❌ فشل تسجيل الدخول باستخدام Google. حاول مرة أخرى.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="text-left">
            <Link
              href="/forgot-password"
              className="text-xs font-bold text-[#ff5c00] hover:underline"
            >
              نسيت كلمة المرور؟
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "جارٍ الدخول..." : "دخول"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">أو</span>
          </div>
        </div>

        <a
          href="/api/auth/google"
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          تسجيل الدخول باستخدام Google
        </a>

        <p className="text-center text-sm text-gray-500 mt-6">
          لا تملك حساباً؟{" "}
          <Link
            href="/register"
            className="text-yellow-600 hover:underline font-medium"
          >
            أنشئ حساباً جديداً
          </Link>
        </p>
      </div>
    </div>
  );
}