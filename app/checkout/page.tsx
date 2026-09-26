"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  CheckCircle2,
  Truck,
  Loader2,
  MapPin,
  Phone,
  User,
  Home,
  Ticket,
  X,
  Check,
} from "lucide-react";

import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useCart } from "@/lib/hooks/useCart";
import {
  CURRENCY,
  SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
} from "@/lib/data/products";

// ═══════════════════════════════════════════
// المدن المغربية
// ═══════════════════════════════════════════
const MOROCCAN_CITIES = [
  "الدار البيضاء",
  "الرباط",
  "مراكش",
  "فاس",
  "طنجة",
  "أكادير",
  "مكناس",
  "وجدة",
  "القنيطرة",
  "تطوان",
  "سلا",
  "المحمدية",
  "خريبكة",
  "بني ملال",
  "الجديدة",
  "تازة",
  "الناظور",
  "سطات",
  "العرائش",
  "خنيفرة",
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, isReady } = useCart();

  // ═══════ Form State ═══════
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // ═══════ UI State ═══════
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ orderNumber: string } | null>(null);
  const [search, setSearch] = useState("");

  // ═══════ الكوبون ═══════
  const [couponCode, setCouponCode] = useState("");
  const [couponId, setCouponId] = useState<number | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  // ═══════ الحسابات ═══════
  const shippingCost =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = Math.max(0, subtotal + shippingCost - couponDiscount);

  // ═══════ إعادة التوجيه إذا السلة فارغة ═══════
  useEffect(() => {
    if (isReady && items.length === 0 && !success) {
      router.push("/");
    }
  }, [isReady, items.length, success, router]);

  // ═══════ تطبيق الكوبون ═══════
  async function applyCoupon() {
    setCouponError("");
    if (!couponCode.trim()) {
      setCouponError("أدخل كود الكوبون");
      return;
    }

    setCouponLoading(true);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotal,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setCouponError(data.message || "كود غير صحيح");
        setCouponId(null);
        setCouponDiscount(0);
        return;
      }

      setCouponId(data.coupon.id);
      setCouponDiscount(data.discount);
      setCouponError("");
    } catch {
      setCouponError("فشل الاتصال بالخادم");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponCode("");
    setCouponId(null);
    setCouponDiscount(0);
    setCouponError("");
  }

  // ═══════ إرسال الطلب ═══════
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!fullName.trim() || fullName.trim().length < 2) {
      setError("الاسم يجب أن يكون حرفين على الأقل");
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      setError("رقم الهاتف غير صالح");
      return;
    }
    if (!city) {
      setError("اختر المدينة");
      return;
    }
    if (!street.trim() || street.trim().length < 5) {
      setError("العنوان قصير جداً");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            variantId: item.variantId,
            productName: item.name,
            variantName:
              [item.selectedColor, item.selectedSize]
                .filter(Boolean)
                .join(" / ") || undefined,
            sku: item.slug,
            imageUrl: item.images[0],
            quantity: item.quantity,
            unitPrice: item.price,
          })),
          subtotal,
          shippingCost,
          discount: couponDiscount,
          couponId: couponId || undefined,
          total,
          address: {
            fullName: fullName.trim(),
            phone: phone.trim(),
            city,
            street: street.trim(),
            postalCode: postalCode.trim() || undefined,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 401) {
          setError("يجب تسجيل الدخول أولاً");
          setTimeout(() => router.push("/login"), 1500);
        } else {
          setError(data.message || "حدث خطأ");
        }
        setLoading(false);
        return;
      }

      setSuccess({ orderNumber: data.order.orderNumber });
      clearCart();
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════
  // صفحة النجاح
  // ═══════════════════════════════════════════
  if (success) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={0}
          onCartClick={() => {}}
        />

        <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
          </div>

          <h1 className="mt-6 text-3xl font-black text-[#111827]">
            🎉 تم استلام طلبك!
          </h1>

          <p className="mt-3 text-base text-[#6b7280]">
            شكراً لثقتك بمتجر نخبة
          </p>

          <div className="mt-6 w-full rounded-2xl bg-white p-6 shadow-md">
            <div className="text-xs text-[#6b7280]">رقم الطلب</div>
            <div className="mt-1 text-2xl font-black text-[#ff5c00]">
              {success.orderNumber}
            </div>

            <div className="mt-4 border-t border-dashed border-gray-200 pt-4 text-sm text-[#6b7280]">
              سنتواصل معك على الهاتف لتأكيد التوصيل. الدفع عند الاستلام.
            </div>
          </div>

          <div className="mt-8 flex w-full gap-3">
            <Link
              href="/"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              <ShoppingBag className="h-4 w-4" />
              متابعة التسوق
            </Link>
          </div>
        </div>

        <Footer />
      </main>
    );
  }

  // ═══════════════════════════════════════════
  // صفحة Checkout
  // ═══════════════════════════════════════════
  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={items.reduce((s, i) => s + i.quantity, 0)}
        onCartClick={() => router.push("/")}
      />

      {/* Breadcrumb */}
      <div className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-[#6b7280]">
          <Link
            href="/"
            className="flex items-center gap-1 font-bold text-[#ff5c00] hover:underline"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            رجوع
          </Link>
          <span>/</span>
          <span>إتمام الطلب</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-5 text-2xl font-black">إتمام الطلب</h1>

        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-3">
          {/* ═══════ اليسار: النموذج ═══════ */}
          <div className="space-y-4 lg:col-span-2">
            {/* معلومات الشحن */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4ed]">
                  <Truck className="h-4 w-4 text-[#ff5c00]" />
                </div>
                <h2 className="text-base font-black">معلومات الشحن</h2>
              </div>

              <div className="space-y-3">
                {/* الاسم */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b5563]">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="أحمد محمد"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                      required
                    />
                  </div>
                </div>

                {/* الهاتف */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b5563]">
                    رقم الهاتف <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0612345678"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                      required
                    />
                  </div>
                </div>

                {/* المدينة */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b5563]">
                    المدينة <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                      required
                    >
                      <option value="">اختر المدينة</option>
                      {MOROCCAN_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* العنوان */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b5563]">
                    العنوان بالتفصيل <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Home className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" />
                    <textarea
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="الحي، الشارع، رقم المنزل..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 py-2.5 pr-10 pl-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                      required
                    />
                  </div>
                </div>

                {/* الرمز البريدي */}
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#4b5563]">
                    الرمز البريدي{" "}
                    <span className="text-gray-400">(اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="20000"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* ═══════ الكوبون ═══════ */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <Ticket className="h-4 w-4 text-[#ff5c00]" />
                كود الخصم
              </h2>

              {couponId ? (
                <div className="flex items-center gap-3 rounded-lg border-2 border-green-500 bg-green-50 p-3">
                  <Check className="h-5 w-5 text-green-600" />
                  <div className="flex-1">
                    <div className="text-sm font-bold text-green-700">
                      {couponCode.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-green-600">
                      وفّرت {couponDiscount} {CURRENCY}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-red-500 transition hover:bg-red-100"
                    aria-label="إزالة"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="أدخل الكود"
                      dir="ltr"
                      className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                    >
                      {couponLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "تطبيق"
                      )}
                    </button>
                  </div>
                  {couponError && (
                    <p className="mt-2 text-xs text-red-600">{couponError}</p>
                  )}
                </>
              )}
            </div>

            {/* طريقة الدفع */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-black">طريقة الدفع</h2>

              <div className="flex items-center gap-3 rounded-lg border-2 border-[#ff5c00] bg-[#fff4ed] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <span className="text-lg">💵</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">الدفع عند الاستلام</div>
                  <div className="text-[11px] text-[#6b7280]">
                    ادفع نقداً أو بالبطاقة عند وصول طلبك
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-[#ff5c00]" />
              </div>
            </div>
          </div>

          {/* ═══════ اليمين: ملخص الطلب ═══════ */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-black">
                <ShoppingBag className="h-4 w-4 text-[#ff5c00]" />
                ملخص الطلب
              </h2>

              {/* قائمة المنتجات */}
              <div className="max-h-64 space-y-3 overflow-y-auto border-b border-gray-100 pb-4">
                {items.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex gap-2">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff5c00] px-1 text-[10px] font-black text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-bold leading-tight">
                        {item.name}
                      </div>
                      {(item.selectedColor || item.selectedSize) && (
                        <div className="mt-0.5 text-[10px] text-[#6b7280]">
                          {[item.selectedColor, item.selectedSize]
                            .filter(Boolean)
                            .join(" / ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-xs font-bold text-[#ff5c00]">
                      {item.price * item.quantity} {CURRENCY}
                    </div>
                  </div>
                ))}
              </div>

              {/* الأسعار */}
              <div className="mt-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-[#6b7280]">
                  <span>المجموع الفرعي</span>
                  <span className="font-bold text-[#111827]">
                    {subtotal} {CURRENCY}
                  </span>
                </div>
                <div className="flex justify-between text-[#6b7280]">
                  <span>الشحن</span>
                  <span
                    className={
                      shippingCost === 0
                        ? "font-bold text-green-600"
                        : "font-bold text-[#111827]"
                    }
                  >
                    {shippingCost === 0
                      ? "مجاني"
                      : `${shippingCost} ${CURRENCY}`}
                  </span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-[#6b7280]">
                    <span>الخصم</span>
                    <span className="font-bold text-green-600">
                      -{couponDiscount} {CURRENCY}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-gray-200 pt-2 text-sm">
                  <span className="font-bold">الإجمالي</span>
                  <span className="text-lg font-black text-[#ff5c00]">
                    {total} {CURRENCY}
                  </span>
                </div>
              </div>

              {/* الخطأ */}
              {error && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              {/* زر التأكيد */}
              <button
                type="submit"
                disabled={loading || items.length === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5c00] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#e64a00] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جاري تأكيد الطلب...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    تأكيد الطلب · {total} {CURRENCY}
                  </>
                )}
              </button>

              <div className="mt-3 text-center text-[10px] text-[#6b7280]">
                بالمتابعة، أنت توافق على الشروط والأحكام
              </div>
            </div>
          </div>
        </form>
      </div>

      <Footer />
    </main>
  );
}