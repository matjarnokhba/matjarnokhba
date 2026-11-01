"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, Store, ArrowLeft } from "lucide-react";

const TYPES = [
  { value: "INDEPENDENT_SUPPLIER", label: "مورد مستقل", Icon: Building2, desc: "شركة أو مصنع أو مورد أو مستورد" },
  { value: "WHOLESALE_TRADER", label: "تاجر جملة", Icon: Store, desc: "شراء وبيع بالجملة" },
];

type Seller = { id: number; storeName: string; isVerified: boolean };

export default function NewBusinessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sellers, setSellers] = useState<Seller[]>([]);

  const [type, setType] = useState("");
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [commercialRegister, setCommercialRegister] = useState("");
  const [taxId, setTaxId] = useState("");
  const [linkedSellerId, setLinkedSellerId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seller/profile");
        if (res.ok) {
          const d = await res.json();
          if (d.success && d.seller) {
            setSellers([{ id: d.seller.id, storeName: d.seller.storeName, isVerified: d.seller.isVerified }]);
          }
        }
      } catch {}
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!type) return setError("اختر نوع النشاط");
    if (name.trim().length < 2) return setError("الاسم التجاري مطلوب");
    if (!city.trim() || !phone.trim()) return setError("المدينة والهاتف مطلوبان");
    if (type === "WHOLESALE_TRADER" && !linkedSellerId) {
      return setError("تاجر الجملة يحتاج متجر تجزئة مربوط");
    }

    setLoading(true);
    try {
      const body: any = { type, name: name.trim(), city: city.trim(), phone: phone.trim() };
      if (legalName.trim()) body.legalName = legalName.trim();
      if (email.trim()) body.email = email.trim();
      if (address.trim()) body.address = address.trim();
      if (commercialRegister.trim()) body.commercialRegister = commercialRegister.trim();
      if (taxId.trim()) body.taxId = taxId.trim();
      if (type === "WHOLESALE_TRADER" && linkedSellerId) body.linkedSellerId = linkedSellerId;

      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) router.push(`/business/${d.business.id}`);
      else setError(d.message || "فشل الإنشاء");
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/business" className="rounded-lg border p-2 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">نشاط تجاري جديد</h1>
          <p className="text-sm text-gray-600">سجّل نشاطك للانضمام إلى سوق الجملة</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl bg-white border p-5 space-y-4">
          <h2 className="font-semibold">نوع النشاط</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {TYPES.map((t) => {
              const Icon = t.Icon;
              const sel = type === t.value;
              return (
                <button type="button" key={t.value} onClick={() => setType(t.value)}
                  className={`rounded-lg border p-3 text-center transition-colors ${sel ? "border-orange-500 bg-orange-50" : "hover:bg-gray-50"}`}>
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${sel ? "text-orange-500" : "text-gray-500"}`} />
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-white border p-5 space-y-4">
          <h2 className="font-semibold">المعلومات الأساسية</h2>
          <div>
            <label className="block text-sm font-medium mb-1">الاسم التجاري *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border p-2" />
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
              <label className="block text-sm font-medium mb-1">الهاتف *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border p-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">العنوان</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border p-2" />
          </div>
        </div>

        <div className="rounded-xl bg-white border p-5 space-y-4">
          <h2 className="font-semibold">معلومات قانونية (اختياري)</h2>
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
        </div>

        {type === "WHOLESALE_TRADER" && (
          <div className="rounded-xl bg-white border p-5 space-y-4">
            <h2 className="font-semibold">ربط متجر التجزئة</h2>
            <p className="text-sm text-gray-600">تاجر الجملة يحتاج متجر تجزئة موثق. سيتم تفعيل الحساب تلقائيًا.</p>
            {sellers.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                ليس لديك متجر تجزئة. أنشئ متجرًا أولًا من لوحة البائع.
              </div>
            ) : (
              <div className="space-y-2">
                {sellers.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50">
                    <input type="radio" name="seller" checked={linkedSellerId === s.id} onChange={() => setLinkedSellerId(s.id)} />
                    <div className="flex-1">
                      <p className="font-medium">{s.storeName}</p>
                      <p className="text-xs text-gray-500">{s.isVerified ? "موثق ✓" : "غير موثق"}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3">
          <Link href="/business" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">إلغاء</Link>
          <button type="submit" disabled={loading} className="rounded-lg bg-orange-500 px-6 py-2 text-white text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "جارٍ الإنشاء..." : "إنشاء النشاط"}
          </button>
        </div>
      </form>
    </div>
  );
}