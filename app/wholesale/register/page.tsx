"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Factory, Building2, Truck, PackageSearch, ArrowRight, ArrowLeft } from "lucide-react";

const SUPPLY_TYPES = [
  { value: "FACTORY", label: "مصنع", Icon: Factory, desc: "إنتاج وتصنيع" },
  { value: "COMPANY", label: "شركة", Icon: Building2, desc: "بيع بالجملة" },
  { value: "SUPPLIER", label: "مورد", Icon: Truck, desc: "توريد منتجات" },
  { value: "IMPORTER", label: "مستورد", Icon: PackageSearch, desc: "استيراد" },
];

export default function WholesaleRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "details">("type");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [supplyActivityType, setSupplyActivityType] = useState("");

  const [accountName, setAccountName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [commercialRegister, setCommercialRegister] = useState("");
  const [taxId, setTaxId] = useState("");
  const [description, setDescription] = useState("");

  function proceedToDetails() {
    if (!supplyActivityType) return setError("اختر نوع النشاط");
    setError("");
    setStep("details");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!accountName.trim()) return setError("الاسم مطلوب");
    if (!email.trim()) return setError("البريد الإلكتروني مطلوب");
    if (password.length < 8) return setError("كلمة المرور 8 أحرف على الأقل");
    if (password !== confirmPassword) return setError("كلمتا المرور غير متطابقتين");
    if (!phone.trim()) return setError("الهاتف مطلوب");
    if (!businessName.trim()) return setError("اسم النشاط مطلوب");
    if (!city.trim()) return setError("المدينة مطلوبة");

    setLoading(true);
    try {
      const res = await fetch("/api/wholesale/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: accountName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          supplyActivityType,
          businessName: businessName.trim(),
          legalName: legalName.trim() || null,
          city: city.trim(),
          address: address.trim() || null,
          commercialRegister: commercialRegister.trim() || null,
          taxId: taxId.trim() || null,
          description: description.trim() || null,
        }),
      });
      const d = await res.json();
      if (d.success) {
        router.push(`/business/${d.businessId}`);
      } else {
        setError(d.message || "فشل التسجيل");
      }
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <header className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/wholesale" className="flex items-center gap-2 font-bold">
            <ArrowRight className="h-4 w-4" />
            <span>سوق الجملة</span>
          </Link>
          <div className="text-sm text-gray-600">
            لديك حساب؟ <Link href="/login" className="text-orange-600 hover:underline">دخول</Link>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {step === "type" && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">سجّل نشاطك التجاري</h1>
              <p className="text-gray-600">انضم إلى سوق الجملة كمورد مستقل — بدون الحاجة لمتجر تجزئة</p>
            </div>

            <div className="rounded-xl bg-white border p-6 space-y-4">
              <h2 className="font-semibold">ما نوع نشاطك التجاري؟</h2>
              <div className="grid grid-cols-2 gap-3">
                {SUPPLY_TYPES.map((t) => {
                  const Icon = t.Icon;
                  const sel = supplyActivityType === t.value;
                  return (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setSupplyActivityType(t.value)}
                      className={`rounded-lg border-2 p-4 text-center transition-colors ${sel ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${sel ? "text-orange-500" : "text-gray-500"}`} />
                      <p className="font-medium">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                    </button>
                  );
                })}
              </div>

              {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

              <button
                onClick={proceedToDetails}
                disabled={!supplyActivityType}
                className="w-full rounded-lg bg-orange-500 text-white py-3 font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                متابعة <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <p className="text-center text-sm text-gray-600">
              لديك متجر تجزئة وترغب بالانضمام؟{" "}
              <Link href="/business/new" className="text-orange-600 hover:underline">انضم كتاجر جملة</Link>
            </p>
          </div>
        )}

        {step === "details" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <button type="button" onClick={() => setStep("type")} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <ArrowRight className="h-4 w-4" /> رجوع
              </button>
              <h1 className="text-2xl font-bold mt-2">معلومات الحساب والنشاط</h1>
              <p className="text-sm text-gray-600">
                نوع النشاط: <strong>{SUPPLY_TYPES.find(t => t.value === supplyActivityType)?.label}</strong>
              </p>
            </div>

            <div className="rounded-xl bg-white border p-5 space-y-4">
              <h2 className="font-semibold">بيانات الحساب</h2>
              <div>
                <label className="block text-sm font-medium mb-1">اسمك الكامل *</label>
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">البريد الإلكتروني *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">كلمة المرور *</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">تأكيد كلمة المرور *</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-lg border p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رقم الهاتف *</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
            </div>

            <div className="rounded-xl bg-white border p-5 space-y-4">
              <h2 className="font-semibold">بيانات النشاط التجاري</h2>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم التجاري *</label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الاسم القانوني</label>
                <input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="w-full rounded-lg border p-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">المدينة *</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">العنوان</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border p-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">السجل التجاري</label>
                  <input value={commercialRegister} onChange={(e) => setCommercialRegister(e.target.value)} className="w-full rounded-lg border p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الرقم الضريبي</label>
                  <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full rounded-lg border p-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">وصف النشاط</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border p-2" />
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              <p className="font-medium mb-1">⚠️ ملاحظة مهمة</p>
              <p>سيتم مراجعة نشاطك خلال 24-48 ساعة. بعد الموافقة، ستتمكن من عرض منتجاتك في سوق الجملة. لن تتمكن من البيع قبل التوثيق.</p>
            </div>

            {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep("type")} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</button>
              <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-orange-500 text-white py-3 font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                {loading ? "جارٍ التسجيل..." : "إنشاء الحساب"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}