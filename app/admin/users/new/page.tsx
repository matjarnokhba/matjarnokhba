"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  UserPlus,
  Check,
  AlertCircle,
  Warehouse,
  Truck,
  UserCheck,
  Shield,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";

type StaffRole = "WAREHOUSE_MANAGER" | "COLLECTOR" | "DELIVERY" | "ADMIN";

const ROLE_OPTIONS: {
  value: StaffRole;
  label: string;
  description: string;
  icon: any;
  color: string;
}[] = [
  {
    value: "WAREHOUSE_MANAGER",
    label: "مسؤول مستودع",
    description: "استلام الطرود، فحص، تجميع شحنات",
    icon: Warehouse,
    color: "text-teal-700",
  },
  {
    value: "COLLECTOR",
    label: "جامع طرود",
    description: "جمع الطرود من التجار وتسليمها للمستودع",
    icon: UserCheck,
    color: "text-purple-700",
  },
  {
    value: "DELIVERY",
    label: "سائق توصيل",
    description: "توصيل الشحنات للعملاء",
    icon: Truck,
    color: "text-orange-700",
  },
  {
    value: "ADMIN",
    label: "مدير",
    description: "صلاحيات إدارية كاملة",
    icon: Shield,
    color: "text-gray-700",
  },
];

function generatePassword(): string {
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export default function CreateStaffPage() {
  const router = useRouter();

  const [role, setRole] = useState<StaffRole>("WAREHOUSE_MANAGER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [vehicleType, setVehicleType] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    email: string;
    password: string;
    role: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/users/create-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: phone.trim() || null,
          role,
          ...(role === "DELIVERY" && {
            city: city.trim(),
            vehicleType: vehicleType.trim() || null,
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الإنشاء");
        return;
      }

      // نجاح — نعرض بيانات الدخول
      setSuccess({
        email: data.user.email,
        password,
        role: data.user.role,
      });
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  }

  // ═══════════════════════════════════════════
  // Success screen
  // ═══════════════════════════════════════════
  if (success) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-lg">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <Check className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mt-5 text-center text-2xl font-black">
            تم إنشاء الحساب
          </h1>
          <p className="mt-2 text-center text-xs text-gray-500">
            سلّم بيانات الدخول للمستخدم بطريقة آمنة
          </p>

          <div className="mt-6 space-y-3 rounded-xl bg-gray-50 p-5">
            <div>
              <div className="text-[10px] font-bold text-gray-500">الدور</div>
              <div className="mt-0.5 text-sm font-black">{success.role}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500">
                البريد الإلكتروني
              </div>
              <div
                className="mt-0.5 break-all font-mono text-sm"
                dir="ltr"
              >
                {success.email}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-500">
                كلمة المرور
              </div>
              <div
                className="mt-0.5 break-all font-mono text-sm"
                dir="ltr"
              >
                {success.password}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            ⚠️ انسخ هذه البيانات الآن — لن تُعرض مرة أخرى.
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={async () => {
                const text = `الدور: ${success.role}\nالبريد: ${success.email}\nكلمة المرور: ${success.password}`;
                try {
                  await navigator.clipboard.writeText(text);
                } catch {}
              }}
              className="rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
            >
              نسخ البيانات
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                setName("");
                setEmail("");
                setPassword("");
                setPhone("");
                setCity("");
                setVehicleType("");
              }}
              className="rounded-lg border border-gray-200 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              إنشاء موظف آخر
            </button>
            <Link
              href="/admin/users"
              className="rounded-lg border border-gray-200 py-3 text-center text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              العودة لقائمة المستخدمين
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // Form
  // ═══════════════════════════════════════════
  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/users"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <UserPlus className="h-6 w-6 text-[#ff5c00]" />
          إنشاء حساب موظف
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          إنشاء حساب موظف جديد (مستودع / جمع / توصيل / مدير)
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-5"
      >
        {/* ═══ اختيار الدور ═══ */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-black text-gray-900">الدور</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROLE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = role === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`flex items-start gap-3 rounded-xl border-2 p-4 text-right transition ${
                    active
                      ? "border-[#ff5c00] bg-[#fff4ed]"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-[#ff5c00] text-white" : "bg-gray-100"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 ${active ? "text-white" : opt.color}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black">{opt.label}</div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ البيانات الأساسية ═══ */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 text-sm font-black text-gray-900">
            البيانات الأساسية
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                الاسم الكامل *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                البريد الإلكتروني *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                كلمة المرور *
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    maxLength={72}
                    dir="ltr"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-10 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const p = generatePassword();
                    setPassword(p);
                    setShowPassword(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  توليد
                </button>
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                8 أحرف على الأقل
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                رقم الهاتف {role === "DELIVERY" && "*"}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required={role === "DELIVERY"}
                dir="ltr"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* ═══ بيانات السائق (فقط DELIVERY) ═══ */}
        {role === "DELIVERY" && (
          <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5">
            <div className="mb-4 text-sm font-black text-orange-900">
              بيانات السائق
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-orange-900">
                  المدينة *
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required={role === "DELIVERY"}
                  placeholder="مثال: الدار البيضاء"
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-orange-900">
                  نوع المركبة (اختياري)
                </label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  placeholder="مثال: دراجة نارية"
                  className="w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ خطأ ═══ */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ═══ زر الإرسال ═══ */}
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#ff5c00] py-4 text-sm font-bold text-white shadow-md transition hover:bg-[#e64a00] disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UserPlus className="h-5 w-5" />
          )}
          {submitting ? "جاري الإنشاء..." : "إنشاء الحساب"}
        </button>
      </form>
    </div>
  );
}