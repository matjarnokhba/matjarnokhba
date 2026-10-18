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