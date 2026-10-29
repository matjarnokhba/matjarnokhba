"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Store, Factory, Warehouse, Building2, Truck, ShoppingBag,
  Briefcase, ArrowLeft, CheckCircle2, AlertCircle,
} from "lucide-react";

type ActivityType =
  | "COMPANY" | "WORKSHOP" | "FACTORY" | "WAREHOUSE"
  | "SHOP" | "DISTRIBUTOR" | "INDEPENDENT";

const ACTIVITY_OPTIONS: { value: ActivityType; label: string; description: string; icon: any }[] = [
  { value: "COMPANY", label: "شركة تجارية", description: "شركة مسجلة توزع أو تبيع بالجملة", icon: Building2 },
  { value: "WORKSHOP", label: "ورشة", description: "ورشة تصنيع أو إنتاج", icon: Briefcase },
  { value: "FACTORY", label: "معمل / مصنع", description: "مصنع بمنتجات من إنتاجه", icon: Factory },
  { value: "WAREHOUSE", label: "مخزن", description: "مخزن أو مستودع لوجستي", icon: Warehouse },
  { value: "SHOP", label: "محل تجاري", description: "محل يبيع بالجملة", icon: ShoppingBag },
  { value: "DISTRIBUTOR", label: "موزع / مورد", description: "موزع معتمد أو مورد جملة", icon: Truck },
  { value: "INDEPENDENT", label: "صاحب جملة مستقل", description: "بائع جملة مستقل بمخزونه الخاص", icon: Store },
];

export default function WholesaleRegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [activityType, setActivityType] = useState<ActivityType | "">("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (displayName.trim().length < 2) { setError("اسم النشاط مطلوب (حرفان على الأقل)"); return; }
    if (!activityType) { setError("اختر نوع النشاط"); return; }
    if (city.trim().length < 2) { setError("المدينة مطلوبة"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/wholesale/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          activityType,
          city: city.trim(),
          region: region.trim() || null,
          description: description.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 401) {
          router.push("/register?next=/wholesale/register");
          return;
        }
        setError(data.message || "فشل التسجيل");
        return;
      }
      router.push("/wholesale/dashboard");
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-12" dir="rtl">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]">
          <ArrowLeft className="h-3.5 w-3.5" />
          عودة للمتجر
        </Link>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-gray-900">افتح حساب بيع بالجملة</h1>
          <p className="mt-2 text-sm text-gray-500">انضم كشركة أو ورشة أو معمل أو مخزن وابدأ البيع للتجار</p>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-700">
              نوع النشاط <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIVITY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = activityType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivityType(opt.value)}
                    className={`rounded-xl border-2 p-3 text-right transition ${selected ? "border-[#ff5c00] bg-[#fff4ed]" : "border-gray-200 bg-white hover:border-gray-300"}`}
                  >
                    <Icon className={`h-5 w-5 ${selected ? "text-[#ff5c00]" : "text-gray-500"}`} />
                    <div className="mt-1.5 text-xs font-bold text-gray-900">{opt.label}</div>
                    <div className="mt-0.5 text-[10px] text-gray-500">{opt.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              اسم الشركة / الورشة / المعمل / المخزن <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="مثال: ورشة النخبة للجلود"
              maxLength={120}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
            <p className="mt-1 text-[10px] text-gray-400">سيظهر هذا الاسم للتجار في صفحتك</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                المدينة <span className="text-red-500">*</span>
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
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">المنطقة</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="المنطقة الصناعية..."
                maxLength={80}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">وصف النشاط</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="ماذا تنتج أو تبيع؟ من هم عملاؤك؟ منذ متى تعمل؟"
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
            />
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
                <li>• بعد الموافقة يمكنك إضافة المصادر والمنتجات</li>
                <li>• منتجاتك تظهر للتجار الموثقين فقط</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 border-t border-gray-100 pt-4">
            <Link href="/" className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-bold text-gray-700 hover:bg-gray-50">
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              إرسال الطلب
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}