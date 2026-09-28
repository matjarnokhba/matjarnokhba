"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("أدخل بريداً إلكترونياً صحيحاً");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الإرسال");
        return;
      }

      setSuccess(true);
      if (data.resetUrl) setDevLink(data.resetUrl);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

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
        {/* الأيقونة */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4ed]">
          <Mail className="h-8 w-8 text-[#ff5c00]" />
        </div>

        <h1 className="mt-5 text-2xl font-black">نسيت كلمة المرور؟</h1>
        <p className="mt-2 text-center text-sm text-[#6b7280]">
          أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور
        </p>

        {success ? (
          <div className="mt-8 w-full rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="mt-4 text-lg font-black">تم الإرسال</h2>
              <p className="mt-2 text-sm text-gray-600">
                إذا كان البريد مسجلاً، ستصلك رسالة تحتوي على رابط إعادة التعيين.
              </p>

              {devLink && (
                <div className="mt-4 w-full rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-left">
                  <div className="text-[10px] font-bold text-amber-700">
                    ⚠️ رابط التطوير (لا يوجد إرسال بريد بعد):
                  </div>
                  <a
                    href={devLink}
                    className="mt-1 block break-all text-[10px] font-mono text-amber-900 hover:underline"
                    dir="ltr"
                  >
                    {devLink}
                  </a>
                </div>
              )}

              <Link
                href="/login"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#ff5c00] hover:underline"
              >
                <ArrowRight className="h-4 w-4" />
                عودة لتسجيل الدخول
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 w-full rounded-2xl bg-white p-6 shadow-sm"
          >
            <label className="mb-1 block text-xs font-bold text-gray-700">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                required
              />
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
                  جاري الإرسال...
                </>
              ) : (
                "إرسال رابط الإعادة"
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
        )}
      </div>

      <Footer />
    </main>
  );
}