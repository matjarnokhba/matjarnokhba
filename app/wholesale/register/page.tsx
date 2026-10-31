"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GeocodingAddressPicker, { GeocodingPlace } from "@/components/address/GeocodingAddressPicker";
import {
  Loader2, Store, Factory, Warehouse, Building2, Truck, ShoppingBag,
  Briefcase, ArrowLeft, CheckCircle2, AlertCircle, User, MapPin, Building,
} from "lucide-react";

type ActivityType =
  | "COMPANY" | "WORKSHOP" | "FACTORY" | "WAREHOUSE"
  | "SHOP" | "DISTRIBUTOR" | "INDEPENDENT";

const ACTIVITY_OPTIONS: {
  value: ActivityType;
  label: string;
  description: string;
  icon: any;
  requiresLocation: boolean;
}[] = [
  { value: "COMPANY", label: "شركة تجارية", description: "شركة مسجلة توزع أو تبيع بالجملة", icon: Building2, requiresLocation: true },
  { value: "FACTORY", label: "معمل / مصنع", description: "مصنع بمنتجات من إنتاجه", icon: Factory, requiresLocation: true },
  { value: "WORKSHOP", label: "ورشة", description: "ورشة تصنيع أو إنتاج", icon: Briefcase, requiresLocation: false },
  { value: "WAREHOUSE", label: "مخزن", description: "مخزن أو مستودع لوجستي", icon: Warehouse, requiresLocation: false },
  { value: "SHOP", label: "محل تجاري", description: "محل يبيع بالجملة", icon: ShoppingBag, requiresLocation: false },
  { value: "DISTRIBUTOR", label: "موزع / مورد", description: "موزع معتمد أو مورد جملة", icon: Truck, requiresLocation: false },
  { value: "INDEPENDENT", label: "صاحب جملة مستقل", description: "بائع جملة مستقل بمخزونه الخاص", icon: Store, requiresLocation: false },
];

export default function WholesaleRegisterPage() {
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [activityType, setActivityType] = useState<ActivityType | "">("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  
  const [location, setLocation] = useState<GeocodingPlace | null>(null);
  const [manualCity, setManualCity] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const selectedOption = ACTIVITY_OPTIONS.find(o => o.value === activityType);
  const requiresLocation = selectedOption?.requiresLocation ?? false;
  
  useEffect(() => {
    if (location && !manualCity) {
      setManualCity(location.city || location.state || location.district || location.name || "");
    }
  }, [location, manualCity]);
  
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    if (name.trim().length < 2) { setError("الاسم الكامل مطلوب (حرفان على الأقل)"); return; }
    if (!email.includes("@") || email.length < 5) { setError("بريد إلكتروني غير صحيح"); return; }
    if (password.length < 8) { setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل"); return; }
    if (password !== passwordConfirm) { setError("كلمتا المرور غير متطابقتين"); return; }
    if (!activityType) { setError("اختر نوع النشاط"); return; }
    if (displayName.trim().length < 2) { setError("اسم الشركة مطلوب"); return; }
    if (!manualCity.trim()) { setError("المدينة مطلوبة"); return; }
    if (requiresLocation && !location) { setError("حدد موقع شركتك على الخريطة (إجباري للشركات والمصانع)"); return; }
    
    setSaving(true);
    try {
      const body: any = {
        mode: "guest",
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || null,
        displayName: displayName.trim(),
        activityType,
        city: manualCity.trim(),
        region: location?.state || null,
        description: description.trim() || null,
        latitude: location?.lat ?? null,
        longitude: location?.lng ?? null,
        address: location?.displayName ?? null,
      };
      
      const res = await fetch("/api/wholesale/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      
      if (!data.success) {
        setError(data.message || "فشل التسجيل");
        setSaving(false);
        return;
      }
      router.push("/seller/wholesale");
      router.refresh();
    } catch {
      setError("فشل الاتصال بالخادم");
      setSaving(false);
    }
  }
  
  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Link href="/wholesale" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" />
          عودة لصفحة الجملة
        </Link>
        
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-gray-900">سجّل شركتك في سوق الجملة</h1>
          <p className="mt-2 text-sm text-gray-500">حساب مستقل تمامًا — لا تحتاج متجر تجزئة</p>
        </div>
        
        <form onSubmit={submit} className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
          {/* Section 1: Account */}
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-gray-900">
              <User className="h-4 w-4 text-[#ff5c00]" /> بيانات حسابك
            </h2>
            <div className="space-y-3">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="الاسم الكامل *" required maxLength={80}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="البريد الإلكتروني *" required dir="ltr"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="رقم الهاتف (اختياري)" dir="ltr"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="كلمة المرور (8+) *" required minLength={8}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
                <input type={showPassword ? "text" : "password"} value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)}
                  placeholder="تأكيد كلمة المرور *" required minLength={8}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                إظهار كلمة المرور
              </label>
            </div>
          </div>
          
          {/* Section 2: Business */}
          <div className="border-t border-gray-100 pt-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-gray-900">
              <Building className="h-4 w-4 text-[#ff5c00]" /> بيانات شركتك
            </h2>
            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold text-gray-700">نوع النشاط *</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACTIVITY_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = activityType === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => setActivityType(opt.value)}
                      className={`rounded-xl border-2 p-3 text-right transition ${selected ? "border-[#ff5c00] bg-[#fff4ed]" : "border-gray-200 hover:border-gray-300"}`}>
                      <Icon className={`h-5 w-5 ${selected ? "text-[#ff5c00]" : "text-gray-500"}`} />
                      <div className="mt-1.5 text-xs font-bold text-gray-900">{opt.label}</div>
                      <div className="mt-0.5 text-[10px] text-gray-500">{opt.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="اسم الشركة / المصنع *" required maxLength={120}
              className="mb-3 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="وصف النشاط (اختياري)" rows={3} maxLength={1000}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
          </div>
          
          {/* Section 3: Location */}
          <div className="border-t border-gray-100 pt-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-gray-900">
              <MapPin className="h-4 w-4 text-[#ff5c00]" /> موقعك
              {requiresLocation && <span className="text-xs text-red-500">(إجباري)</span>}
            </h2>
            
            <GeocodingAddressPicker
              label={requiresLocation ? "حدد موقع شركتك على الخريطة *" : "حدد موقع شركتك (اختياري)"}
              placeholder="ابحث عن المدينة، الشارع، أو الحي..."
              value={location}
              onChange={setLocation}
              hint={requiresLocation ? "ضروري للشركات والمصانع" : "يساعد التجار على تحديد موقعك"}
              required={requiresLocation}
            />
            
            <div className="mt-3">
              <label className="mb-1 block text-xs font-bold text-gray-700">المدينة *</label>
              <input type="text" value={manualCity} onChange={e => setManualCity(e.target.value)}
                placeholder="الدار البيضاء" required maxLength={80}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white" />
              {location?.city && manualCity !== location.city && (
                <button type="button" onClick={() => setManualCity(location.city || "")}
                  className="mt-1 text-[10px] text-[#ff5c00] hover:underline">
                  استخدم &quot;{location.city}&quot; من الموقع المحدد
                </button>
              )}
            </div>
          </div>
          
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-bold">ما بعد التسجيل</div>
              <ul className="mt-1 space-y-0.5 text-[11px]">
                <li>• يخضع حسابك للمراجعة من الإدارة</li>
                <li>• بعد الموافقة يمكنك إضافة المنتجات والأسعار</li>
                <li>• منتجاتك تظهر للتجار المعتمدين فقط</li>
              </ul>
            </div>
          </div>
          
          <div className="flex gap-2 border-t border-gray-100 pt-4">
            <Link href="/wholesale" className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-bold text-gray-700 hover:bg-gray-50">إلغاء</Link>
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "جارٍ التسجيل..." : "إنشاء الحساب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}