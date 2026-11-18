"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Store,
  Save,
  AlertCircle,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  ExternalLink,
  Info,
  Lock,
  Navigation,
} from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import { MapPicker } from "@/components/maps";
import type { MapCoords } from "@/components/maps";

type Seller = {
  id: number;
  storeName: string;
  slug: string;
  description: string | null;
  logo: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  isVerified: boolean;
  createdAt: string;
  _count: {
    products: number;
    orders: number;
  };
};

export default function SellerProfilePage() {
  const router = useRouter();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);

  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [location, setLocation] = useState<MapCoords | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/seller/profile");
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "فشل التحميل");
          return;
        }

        const s = data.seller;
        setSeller(s);
        setStoreName(s.storeName);
        setDescription(s.description || "");
        setCity(s.city || "");
        setRegion(s.region || "");
        setLogoUrls(s.logo ? [s.logo] : []);
        setLocation(
          s.latitude != null && s.longitude != null
            ? { lat: s.latitude, lng: s.longitude }
            : null
        );
      } catch {
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (storeName.trim().length < 2) {
      setError("اسم المتجر يجب أن يكون حرفين على الأقل");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/seller/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: storeName.trim(),
          description: description.trim() || null,
          city: city.trim() || null,
          region: region.trim() || null,
          logo: logoUrls[0] || null,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }

      setSeller((prev) =>
        prev
          ? {
              ...prev,
              storeName: data.seller.storeName,
              description: data.seller.description,
              city: data.seller.city,
              region: data.seller.region,
              logo: data.seller.logo,
              latitude: data.seller.latitude ?? null,
              longitude: data.seller.longitude ?? null,
            }
          : prev
      );

      setSuccess("تم حفظ التغييرات بنجاح");
      router.refresh();
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  // ═══ التحميل ═══
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error && !seller) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h1 className="mt-4 text-xl font-black">{error}</h1>
      </div>
    );
  }

  if (!seller) return null;

  const storeUrl = `/store/${seller.slug}`;
  const hasLocation = seller.latitude != null && seller.longitude != null;

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* ═══ Header ═══ */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">ملف المتجر</h1>
        <p className="mt-1 text-sm text-gray-500">
          عدّل بيانات متجرك العامة
        </p>
      </div>

      {/* ═══ بطاقة معلومات المتجر ═══ */}
      <div className="mb-4 rounded-2xl bg-gradient-to-br from-[#0a1a35] via-[#122a4d] to-[#0a1a35] p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white shadow-xl">
            {seller.logo ? (
              <img
                src={seller.logo}
                alt={seller.storeName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-yellow-400 to-amber-500 text-2xl font-black text-[#0a1a35]">
                {seller.storeName.charAt(0)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black">{seller.storeName}</h2>
              {seller.isVerified && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-white" />
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-white/70">
              <span className="font-mono">/store/{seller.slug}</span>
              <Link
                href={storeUrl}
                target="_blank"
                className="flex items-center gap-1 font-bold text-yellow-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                عرض
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 backdrop-blur">
                {seller._count.products} منتج
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 backdrop-blur">
                {seller._count.orders} طلب
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-bold backdrop-blur ${
                  seller.status === "ACTIVE"
                    ? "bg-green-500/20 text-green-300"
                    : seller.status === "PENDING"
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-red-500/20 text-red-300"
                }`}
              >
                {seller.status === "ACTIVE"
                  ? "✓ نشط"
                  : seller.status === "PENDING"
                    ? "⏳ بانتظار الموافقة"
                    : "⚠️ معطّل"}
              </span>
              {hasLocation && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-bold text-emerald-300 backdrop-blur">
                  <Navigation className="h-3 w-3" />
                  موقع محدد
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Slug (مقفل) ═══ */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-black text-blue-900">رابط المتجر محمي</div>
          <div className="mt-1 text-xs text-blue-700">
            الرابط الحالي:{" "}
            <span className="font-mono font-bold">/store/{seller.slug}</span>
          </div>
          <div className="mt-1 text-[11px] text-blue-600">
            💡 لا يمكن تعديل الرابط — لأنه مرتبط بكل منتجاتك ويؤثر على الروابط
            المفهرسة في محركات البحث.
          </div>
        </div>
      </div>

      {/* ═══ النموذج ═══ */}
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl rounded-2xl bg-white p-5 shadow-sm sm:p-6"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black">
          <Store className="h-4 w-4 text-[#ff5c00]" />
          المعلومات الأساسية
        </h2>

        <div className="space-y-4">
          {/* اسم المتجر */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              اسم المتجر <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={80}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              required
            />
          </div>

          {/* الوصف */}
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              وصف المتجر
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

          {/* المدينة + المنطقة */}
          <div className="grid gap-3 sm:grid-cols-2">
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
                  maxLength={80}
                  placeholder="الدار البيضاء"
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
                maxLength={80}
                placeholder="الدار البيضاء-سطات"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>

          {/* ═══ موقع المتجر على الخريطة (M11.3b) ═══ */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="flex items-center gap-2 text-sm font-black text-gray-900">
                  <Navigation className="h-4 w-4 text-emerald-600" />
                  موقع المتجر على الخريطة
                </h3>
                <p className="mt-1 text-[11px] text-gray-600">
                  حدد موقع متجرك بدقة على الخريطة — يستخدمه جامعو الطرود وموظفو
                  التوصيل للوصول إليك دون البحث اليدوي.
                </p>
              </div>
              {hasLocation && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  محدد
                </span>
              )}
            </div>

            <MapPicker
              initial={location}
              height={340}
              showMyLocation={true}
              onChange={(c) => setLocation(c)}
            />

            <div className="mt-2 flex items-start gap-2 rounded-lg bg-white/70 p-2 text-[10px] text-gray-600">
              <Info className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
              <span>
                {location
                  ? "سيُحفظ الموقع عند الضغط على «حفظ التغييرات» أدناه."
                  : "اضغط على الخريطة، أو استخدم زر «موقعي» (إن كنت في المتجر الآن)، ثم اضغط «حفظ التغييرات»."}
              </span>
            </div>
          </div>

          {/* الشعار */}
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-700">
              شعار المتجر
            </label>
            <ImageUploader
              value={logoUrls}
              onChange={(urls) => setLogoUrls(urls.slice(-1))}
            />
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>
                يُفضّل استخدام صورة مربعة بحجم صغير (يظهر كشعار في صفحة المتجر
                والمنتجات).
              </span>
            </div>
          </div>
        </div>

        {/* رسائل */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {success}
          </div>
        )}

        {/* الزر */}
        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            حفظ التغييرات
          </button>

          <Link
            href={storeUrl}
            target="_blank"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4" />
            عرض متجري
          </Link>
        </div>
      </form>
    </div>
  );
}