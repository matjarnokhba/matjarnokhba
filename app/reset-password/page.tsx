"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  XCircle,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

type TokenStatus = "loading" | "valid" | "invalid";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<TokenStatus>("loading");
  const [invalidReason, setInvalidReason] = useState("");
  const [userName, setUserName] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [search, setSearch] = useState("");

  // ═══ التحقق من الرابط عند الفتح ═══
  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setInvalidReason("الرابط لا يحتوي على رمز إعادة التعيين");
      return;
    }

    async function verify() {
      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${token}`);
        const data = await res.json();

        if (data.valid) {
          setStatus("valid");
          setUserName(data.user?.name || null);
        } else {
          setStatus("invalid");
          setInvalidReason(data.reason || "الرابط غير صحيح");
        }
      } catch {
        setStatus("invalid");
        setInvalidReason("فشل التحقق من الرابط");
      }
    }

    verify();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("الرابط غير صحيح");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل التعيين");
        setStatus("invalid");
        setInvalidReason(data.message || "فشل التعيين");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  // ═══ حالات العرض ═══
  const isInvalid = status === "invalid" || success === false && invalidReason;
  const isLoading = status === "loading";

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
        {/* ═══ جاري التحقق ═══ */}
        {isLoading && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
            <h1 className="mt-5 text-2xl font-black">جاري التحقق...</h1>
            <p className="mt-2 text-center text-sm text-[#6b7280]">
              نتحقق من صحة الرابط
            </p>
          </>
        )}

        {/* ═══ رابط غير صحيح / مستخدم / منتهي ═══ */}
        {isInvalid && !success && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="mt-5 text-2xl font-black">الرابط غير صالح</h1>
            <p className="mt-3 max-w-sm text-center text-sm text-[#6b7280]">
              {invalidReason || "الرابط غير صحيح أو انتهت صلاحيته"}
            </p>

            <div className="mt-8 w-full rounded-2xl bg-white p-6 shadow-sm">
              <p className="mb-4 text-center text-sm text-gray-600">
                لطلب رابط جديد، اضغط على الزر أدناه
              </p>
              <Link
                href="/forgot-password"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
              >
                <ArrowRight className="h-4 w-4" />
                طلب رابط جديد
              </Link>
              <Link
                href="/login"
                className="mt-3 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
              >
                عودة لتسجيل الدخول
              </Link>
            </div>
          </>
        )}

        {/* ═══ نجاح ═══ */}
        {success && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="mt-5 text-2xl font-black">تم التعيين بنجاح</h1>
            <p className="mt-2 text-center text-sm text-[#6b7280]">
              سيتم تحويلك لصفحة تسجيل الدخول...
            </p>
            <div className="mt-6">
              <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
            </div>
          </>
        )}

        {/* ═══ رابط صالح → نموذج ═══ */}
        {status === "valid" && !success && (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4ed]">
              <Lock className="h-8 w-8 text-[#ff5c00]" />
            </div>

            <h1 className="mt-5 text-2xl font-black">
              إعادة تعيين كلمة المرور
            </h1>
            <p className="mt-2 text-center text-sm text-[#6b7280]">
              {userName
                ? `مرحباً ${userName}، أدخل كلمة مرور جديدة`
                : "أدخل كلمة المرور الجديدة"}
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-8 w-full rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    كلمة المرور الجديدة
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      dir="ltr"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-10 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="أعد كتابة كلمة المرور"
                      dir="ltr"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                      required
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري التعيين...
                  </>
                ) : (
                  "تعيين كلمة المرور"
                )}
              </button>

              <Link
                href="/login"
                className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                عودة لتسجيل الدخول
              </Link>
            </form>
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f6f2]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}