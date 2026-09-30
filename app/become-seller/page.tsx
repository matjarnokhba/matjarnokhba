"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  TrendingUp,
  Users,
  Package,
  Wallet,
  CheckCircle2,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function BecomeSellerPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [city, setCity] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [search, setSearch] = useState("");

  function generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 80);
  }

  function handleStoreNameChange(value: string) {
    setStoreName(value);
    if (!slug || slug === generateSlug(storeName)) {
      setSlug(generateSlug(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (name.trim().length < 2) {
      setError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (!email.includes("@")) {
      setError("بريد إلكتروني غير صحيح");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (storeName.trim().length < 2) {
      setError("اسم المتجر يجب أن يكون حرفين على الأقل");
      return;
    }
    if (!slug || slug.length < 2) {
      setError("رابط المتجر مطلوب");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/seller/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          storeName: storeName.trim(),
          slug: slug.trim(),
          city: city.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل إنشاء الحساب");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/seller");
        router.refresh();
      }, 2500);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  // ═══ النجاح ═══
  if (success) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={0}
          onCartClick={() => {}}
        />

        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
          </div>

          <h1 className="mt-6 text-3xl font-black">🎉 مرحباً بك!</h1>
          <p className="mt-3 text-base text-gray-600">
            تم إنشاء حساب تاجر وفتح متجر "{storeName}"
          </p>
          <p className="mt-2 text-sm text-gray-500">
            سيتم مراجعة متجرك من قبل الإدارة. يمكنك البدء بإعداد منتجاتك الآن.
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            جاري تحويلك للوحة البائع...
          </div>
        </div>

        <Footer />
      </main>
    );
  }

  // ═══ النموذج ═══
  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      {/* ═══ Hero ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a1a35] via-[#122a4d] to-[#0a1a35]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-20 right-1/4 h-64 w-64 rounded-full bg-yellow-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 text-center sm:py-12">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl">
            <Store className="h-8 w-8 text-[#0a1a35]" />
          </div>

          <h1 className="mt-5 text-3xl font-black text-white sm:text-4xl">
            بِع معنا واكسب أكثر
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/80 sm:text-base">
            انضم لآلاف التجار على متجر نخبة. ابدأ متجرك في دقائق، وأضف منتجاتك،
            واستقبل طلبات من كل المغرب.
          </p>

          {/* المزايا */}
          <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Feature icon={Users} label="عملاء كثيرون" />
            <Feature icon={Package} label="أضف منتجاتك" />
            <Feature icon={Wallet} label="أرباح تنافسية" />
            <Feature icon={TrendingUp} label="نمو مبيعاتك" />
          </div>
        </div>
      </section>

      {/* ═══ النموذج ═══ */}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-black">أنشئ حساب التاجر</h2>
            <p className="mt-1 text-xs text-gray-500">
              دقيقة واحدة فقط لبدء رحلتك
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ═══ القسم 1: الحساب ═══ */}
            <Section title="1️⃣ بياناتك" number={1}>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الاسم الكامل <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="محمد أحمد"
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  البريد الإلكتروني <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  كلمة المرور <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 أحرف على الأقل"
                    dir="ltr"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    required
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
            </Section>

            {/* ═══ القسم 2: المتجر ═══ */}
            <Section title="2️⃣ متجرك" number={2}>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  اسم المتجر <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => handleStoreNameChange(e.target.value)}
                  placeholder="مثال: متجر الأناقة"
                  maxLength={80}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  رابط المتجر <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 focus-within:border-[#ff5c00] focus-within:bg-white">
                  <span className="shrink-0 border-l border-gray-200 bg-gray-100 px-3 py-2.5 text-[10px] text-gray-500">
                    /store/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(generateSlug(e.target.value))}
                    placeholder="my-store"
                    dir="ltr"
                    className="flex-1 bg-transparent px-3 py-2.5 font-mono text-xs outline-none"
                    required
                  />
                </div>
                <p className="mt-1 text-[10px] text-gray-400">
                  رابطك: /store/{slug || "رابط-متجرك"}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  المدينة (اختياري)
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="الدار البيضاء"
                  maxLength={80}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
            </Section>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Note */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                سيتم مراجعة متجرك من الإدارة قبل التفعيل الكامل. يمكنك البدء
                بإعداد منتجاتك فوراً.
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#e64a00] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الإنشاء...
                </>
              ) : (
                <>
                  <Store className="h-4 w-4" />
                  إنشاء حساب التاجر
                </>
              )}
            </button>

            <div className="text-center text-xs text-gray-500">
              لديك حساب بالفعل؟{" "}
              <Link
                href="/login"
                className="font-bold text-[#ff5c00] hover:underline"
              >
                تسجيل الدخول
              </Link>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </main>
  );
}

// ═══ Section component ═══
function Section({
  title,
  number,
  children,
}: {
  title: string;
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        <span className="text-sm font-black text-gray-900">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ═══ Feature badge ═══
function Feature({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white/5 p-3 backdrop-blur">
      <Icon className="h-5 w-5 text-yellow-400" />
      <span className="text-[10px] font-bold text-white/90">{label}</span>
    </div>
  );
}