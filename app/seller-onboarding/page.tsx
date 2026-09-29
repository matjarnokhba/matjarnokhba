"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Store,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function SellerOnboardingPage() {
  const router = useRouter();

  const [storeName, setStoreName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const data = await res.json();
        if (!data.success || !data.user) {
          router.push("/login");
          return;
        }
      } catch {
        router.push("/login");
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [router]);

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

    if (storeName.trim().length < 2) {
      setError("اسم المتجر يجب أن يكون حرفين على الأقل");
      return;
    }
    if (slug.length < 2) {
      setError("الرابط (slug) مطلوب");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError("الرابط يجب أن يحتوي حروفاً إنجليزية صغيرة وأرقاماً وشرطات فقط");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/seller/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: storeName.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          city: city.trim() || null,
          region: region.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل إنشاء المتجر");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/seller");
        router.refresh();
      }, 2000);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
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
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mt-5 text-2xl font-black">🎉 تم إنشاء متجرك!</h1>
          <p className="mt-3 text-sm text-gray-600">
            متجرك الآن قيد المراجعة. سيتم تفعيله من قبل الإدارة قريباً.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            سيتم تحويلك للوحة التحكم...
          </p>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={0}
        onCartClick={() => {}}
      />

      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg">
            <Store className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-black">أنشئ متجرك</h1>
          <p className="mt-2 text-sm text-gray-500">
            انضم إلى منصة متجر نخبة كتاجر — أضف منتجاتك واستقبل طلبات من كل المغرب.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <div className="text-2xl">📦</div>
            <div className="mt-1 text-[10px] font-bold text-gray-700">
              أضف منتجاتك
            </div>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <div className="text-2xl">🚚</div>
            <div className="mt-1 text-[10px] font-bold text-gray-700">
              نوصل للعميل
            </div>
          </div>
          <div className="rounded-xl bg-white p-3 text-center shadow-sm">
            <div className="text-2xl">💰</div>
            <div className="mt-1 text-[10px] font-bold text-gray-700">
              اربح معنا
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <div className="mb-4">
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

          <div className="mb-4">
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
              يمكن للعميل الوصول لمتجرك عبر: /store/{slug || "رابط-متجرك"}
            </p>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-bold text-gray-700">
              وصف المتجر (اختياري)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="اكتب وصفاً مختصراً عن متجرك..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
            <div className="mt-1 text-left text-[10px] text-gray-400">
              {description.length} / 500
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                المدينة
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="الدار البيضاء"
                  maxLength={80}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                المنطقة
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="الدار البيضاء-سطات"
                maxLength={80}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              سيتم مراجعة متجرك من قبل الإدارة قبل تفعيله. يمكنك البدء بإضافة منتجاتك الآن.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإنشاء...
              </>
            ) : (
              <>
                <Store className="h-4 w-4" />
                إنشاء المتجر
              </>
            )}
          </button>

          <Link
            href="/"
            className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            العودة للرئيسية
          </Link>
        </form>
      </div>

      <Footer />
    </main>
  );
}