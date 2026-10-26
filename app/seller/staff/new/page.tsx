"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import {
  ALL_STAFF_PERMISSIONS,
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  type StaffPermissionKey,
} from "@/lib/staff-permissions";

const GROUP_ORDER = ["منتجات", "طلبات", "تجهيز", "مرتجعات", "دفعات", "تقييمات", "إشعارات", "محفظة", "أدوات", "أداء"];

export default function NewStaffPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<string[]>([...DEFAULT_STAFF_PERMISSIONS]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePerm(key: StaffPermissionKey) {
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/seller/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          password,
          permissions: perms,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "فشل إنشاء الموظف");
        return;
      }
      router.push("/seller/staff");
      router.refresh();
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/seller/staff"
          className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-gray-900"
        >
          <ArrowRight className="h-4 w-4" />
          عودة للموظفين
        </Link>

        <h1 className="mb-1 flex items-center gap-2 text-2xl font-black">
          <UserPlus className="h-6 w-6 text-[#ff5c00]" />
          إضافة موظف جديد
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          أنشئ حسابًا لموظف وحدد صلاحياته داخل متجرك
        </p>

        <form onSubmit={submit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold">الاسم الكامل *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={80}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold">الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold">البريد الإلكتروني *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              dir="ltr"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold">كلمة المرور *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              كلمة المرور الأولى للموظف — يُنصح بتغييرها عند أول دخول
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold">
              الصلاحيات * ({perms.length} محددة)
            </label>
            <div className="space-y-3">
              {GROUP_ORDER.map((group) => {
                const groupPerms = ALL_STAFF_PERMISSIONS.filter(
                  (k) => PERMISSION_LABELS[k].group === group
                );
                if (groupPerms.length === 0) return null;
                return (
                  <div key={group}>
                    <div className="mb-1 text-[10px] font-black text-gray-500">{group}</div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {groupPerms.map((key) => {
                        const meta = PERMISSION_LABELS[key];
                        const checked = perms.includes(key);
                        return (
                          <label
                            key={key}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
                              checked
                                ? "border-[#ff5c00] bg-[#fff4ed] font-bold text-[#ff5c00]"
                                : "border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePerm(key)}
                              className="h-3.5 w-3.5"
                            />
                            <span>{meta.label}</span>
                            {meta.sensitive && (
                              <span className="ml-auto rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">
                                حساس
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Link
              href="/seller/staff"
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              إنشاء الموظف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}