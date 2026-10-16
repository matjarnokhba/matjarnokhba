"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ShoppingBag,
  CheckCircle2,
  Truck,
  Loader2,
  MapPin,
  Ticket,
  X,
  Check,
  Plus,
  AlertCircle,
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
import AddressForm, {
  type AddressFormData,
} from "@/components/address/AddressForm";
import AddressCard, {
  type AddressDisplay,
} from "@/components/address/AddressCard";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart, isReady } = useCart();

  // ═══════ Idempotency Key ═══════
  const idempotencyKeyRef = useRef<string>("");
  useEffect(() => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
  }, []);

  // ═══════ Auth ═══════
  const [userId, setUserId] = useState<number | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // ═══════ Addresses ═══════
  const [addresses, setAddresses] = useState<AddressDisplay[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(
    null
  );
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // ═══════ Coupon ═══════
  const [couponCode, setCouponCode] = useState("");
  const [couponId, setCouponId] = useState<number | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  // ═══════ UI State ═══════
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    orders: Array<{ orderNumber: string; sellerId: number }>;
  } | null>(null);
  const [search, setSearch] = useState("");

  // ═══════ Shipping ═══════
  const shippingCost =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = Math.max(0, subtotal + shippingCost - couponDiscount);

  // ═══════ Redirect if cart empty ═══════
  useEffect(() => {
    if (isReady && items.length === 0 && !success) {
      router.push("/");
    }
  }, [isReady, items.length, success, router]);

  // ═══════ Check auth ═══════
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.success && data.user) {
          setUserId(data.user.id);
        } else {
          router.push("/login?redirect=/checkout");
        }
      } catch {
        router.push("/login?redirect=/checkout");
      } finally {
        setAuthChecking(false);
      }
    }
    checkAuth();
  }, [router]);

  // ═══════ Load addresses ═══════
  async function loadAddresses() {
    setAddressesLoading(true);
    try {
      const res = await fetch("/api/user/addresses");
      const data = await res.json();
      if (data.success) {
        setAddresses(data.addresses);

        const def = data.addresses.find((a: AddressDisplay) => a.isDefault);
        if (def) {
          setSelectedAddressId(def.id);
        } else if (data.addresses.length > 0) {
          setSelectedAddressId((prev) => prev ?? data.addresses[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAddressesLoading(false);
    }
  }

  useEffect(() => {
    if (userId) loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ═══════ Coupon ═══════
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
        body: JSON.stringify({ code: couponCode.trim(), subtotal }),
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

  // ═══════ Add new address ═══════
  async function handleAddAddress(form: AddressFormData) {
    const res = await fetch("/api/user/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        city: form.city,
        district: form.district,
        fullAddressText: form.fullAddressText,
        buildingNumber: form.buildingNumber || null,
        landmark: form.landmark || null,
        postalCode: form.postalCode || null,
        isDefault: form.isDefault,
      }),
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "فشل الحفظ");
    }

    setShowAddModal(false);
    await loadAddresses();
    if (data.address?.id) {
      setSelectedAddressId(data.address.id);
    }
  }

  // ═══════ Submit ═══════
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedAddressId) {
      setError("اختر عنوانًا للتوصيل أو أضف عنوانًا جديدًا");
      return;
    }

    const selectedAddress = addresses.find(
      (a) => a.id === selectedAddressId
    );
    if (!selectedAddress) {
      setError("العنوان غير موجود");
      return;
    }

    setLoading(true);

    try {
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }

      // ═══ Snapshot from selected address ═══
      const snapCity =
        selectedAddress.cityText || selectedAddress.city || "";
      const snapDistrict =
        selectedAddress.districtText || selectedAddress.district || "";
      const snapStreet =
        selectedAddress.fullAddressText ||
        selectedAddress.street ||
        "";

      const addressSnapshot = {
        fullName: selectedAddress.fullName,
        firstName: selectedAddress.firstName || undefined,
        lastName: selectedAddress.lastName || undefined,
        phone: selectedAddress.phone,

        // Legacy fields (يقرأها السيرفر)
        city: snapCity,
        street: snapStreet,
        district: snapDistrict || undefined,

        // Extended fields (للـsnapshot الكامل)
        cityPlaceId: selectedAddress.cityPlaceId || undefined,
        districtPlaceId: selectedAddress.districtPlaceId || undefined,
        fullAddress: snapStreet,
        fullAddressPlaceId:
          selectedAddress.fullAddressPlaceId || undefined,

        latitude: selectedAddress.latitude || undefined,
        longitude: selectedAddress.longitude || undefined,

        buildingNumber: selectedAddress.buildingNumber || undefined,
        landmark: selectedAddress.landmark || undefined,
        postalCode: selectedAddress.postalCode || undefined,
      };

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          couponCode: couponCode?.trim() || undefined,
          shippingAddressId: selectedAddressId,
          address: addressSnapshot,
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

      setSuccess({ orders: data.orders });
      clearCart();
    } catch (err) {
      console.error(err);
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════
  // Success page
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
            {success.orders.length > 1
              ? `تم إنشاء ${success.orders.length} طلبات (واحد لكل تاجر)`
              : "شكراً لثقتك بمتجر نخبة"}
          </p>

          <div className="mt-6 w-full rounded-2xl bg-white p-6 shadow-md">
            <div className="text-xs text-[#6b7280]">
              {success.orders.length > 1 ? "أرقام الطلبات" : "رقم الطلب"}
            </div>

            <div className="mt-2 space-y-2">
              {success.orders.map((o) => (
                <div
                  key={o.orderNumber}
                  className="rounded-lg bg-[#fff4ed] px-3 py-2 font-mono text-base font-black text-[#ff5c00]"
                >
                  {o.orderNumber}
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-dashed border-gray-200 pt-4 text-sm text-[#6b7280]">
              سنتواصل معك على الهاتف لتأكيد التوصيل. الدفع عند الاستلام.
            </div>
          </div>

          <div className="mt-8 flex w-full flex-col gap-3">
            <Link
              href="/orders"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
            >
              <ShoppingBag className="h-4 w-4" />
              عرض طلباتي
            </Link>
            <Link
              href="/"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              متابعة التسوق
            </Link>
          </div>
        </div>

        <Footer />
      </main>
    );
  }

  // ═══════════════════════════════════════════
  // Auth checking
  // ═══════════════════════════════════════════
  if (authChecking) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={items.reduce((s, i) => s + i.quantity, 0)}
          onCartClick={() => router.push("/")}
        />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
        </div>
        <Footer />
      </main>
    );
  }

  // ═══════════════════════════════════════════
  // Checkout Page
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
          <div className="space-y-4 lg:col-span-2">
            {/* Address Section */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fff4ed]">
                    <Truck className="h-4 w-4 text-[#ff5c00]" />
                  </div>
                  <h2 className="text-base font-black">عنوان التوصيل</h2>
                </div>

                {addresses.length > 0 && addresses.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1 rounded-lg border border-[#ff5c00] bg-white px-3 py-1.5 text-xs font-bold text-[#ff5c00] transition hover:bg-[#fff4ed]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    عنوان جديد
                  </button>
                )}
              </div>

              {addressesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <MapPin className="mx-auto h-10 w-10 text-gray-300" />
                  <h3 className="mt-3 text-sm font-black">
                    لا توجد عناوين محفوظة
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    أضف عنوانك الأول لإتمام الطلب
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    إضافة عنوان
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((a) => (
                    <AddressCard
                      key={a.id}
                      address={a}
                      selected={selectedAddressId === a.id}
                      onSelect={setSelectedAddressId}
                      showActions={false}
                    />
                  ))}

                  <Link
                    href="/profile/addresses"
                    className="block text-center text-xs font-bold text-[#ff5c00] hover:underline"
                  >
                    إدارة العناوين →
                  </Link>
                </div>
              )}
            </div>

            {/* Coupon */}
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
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
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

            {/* Payment */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-base font-black">طريقة الدفع</h2>

              <div className="flex items-center gap-3 rounded-lg border-2 border-[#ff5c00] bg-[#fff4ed] p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
                  <span className="text-lg">💵</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">الدفع عند الاستلام</div>
                  <div className="text-[11px] text-[#6b7280]">
                    ادفع نقداً عند وصول طلبك
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-[#ff5c00]" />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 flex items-center gap-2 text-base font-black">
                <ShoppingBag className="h-4 w-4 text-[#ff5c00]" />
                ملخص الطلب
              </h2>

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

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading ||
                  items.length === 0 ||
                  !selectedAddressId ||
                  addresses.length === 0
                }
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

      {/* Add Address Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">إضافة عنوان جديد</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AddressForm
              onSubmit={handleAddAddress}
              onCancel={() => setShowAddModal(false)}
              submitLabel="إضافة العنوان"
            />
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}