"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Factory, Building2, Truck, ArrowRight } from "lucide-react";

type EntityType = "COMPANY" | "FACTORY" | "SUPPLIER";

const OPTIONS: { value: EntityType; label: string; desc: string; Icon: any }[] = [
  { value: "COMPANY", label: "شركة", desc: "شركة توزيع أو تجارة", Icon: Building2 },
  { value: "FACTORY", label: "مصنع", desc: "تصنيع مباشر", Icon: Factory },
  { value: "SUPPLIER", label: "مورد", desc: "مورد من خارج المنصة", Icon: Truck },
];

export default function JoinWholesalePage() {
  const router = useRouter();
  const [entityType, setEntityType] = useState<EntityType>("COMPANY");
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/seller/wholesale/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, city, entityType }),
      });
      const d = await res.json();
      if (d.success) {
        router.push("/seller/wholesale");
      } else {
        setError(d.message || "فشل الانضمام");
        setLoading(false);
      }
    } catch {
      setError("خطأ في الاتصال");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href="/seller" className="text-sm text-gray-600 hover:underline inline-flex items-center gap-1">
        <ArrowRight className="h-4 w-4 rotate-180" /> العودة للوحة التاجر
      </Link>

      <div>
        <h1 className="text-2xl font-bold">انضم إلى سوق الجملة</h1>
        <p className="text-sm text-gray-600 mt-1">
          الآن يمكنك البيع بالجملة للتجار الآخرين. متجرك الحالي سيبقى مستقلًا تمامًا.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2">نوع الكيان</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEntityType(opt.value)}
                className={`rounded-xl border-2 p-4 text-center transition ${
                  entityType === opt.value
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <opt.Icon className={`h-8 w-8 mx-auto mb-2 ${entityType === opt.value ? "text-orange-500" : "text-gray-400"}`} />
                <div className="font-semibold">{opt.label}</div>
                <div className="text-xs text-gray-600 mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">الاسم التجاري</label>
          <input
            type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            required minLength={2} maxLength={100}
            className="w-full rounded-lg border p-2"
            placeholder="مثال: شركة النخبة للتوزيع"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">المدينة</label>
          <input
            type="text" value={city} onChange={(e) => setCity(e.target.value)}
            required minLength={2} maxLength={100}
            className="w-full rounded-lg border p-2"
            placeholder="الدار البيضاء"
          />
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

        <button
          type="submit" disabled={loading || displayName.length < 2 || city.length < 2}
          className="w-full rounded-lg bg-orange-500 px-4 py-3 text-white font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "انضم الآن"}
        </button>
      </form>
    </div>
  );
}