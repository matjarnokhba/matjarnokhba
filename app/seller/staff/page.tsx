"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Users,
  Plus,
  UserX,
  UserCheck,
  Trash2,
  Shield,
  Mail,
  Phone,
} from "lucide-react";

type StaffRow = {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  permissions: string[];
  createdAt: string;
};

export default function StaffListPage() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seller/staff", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "تعذر تحميل الموظفين");
      } else {
        setStaff(data.staff || []);
      }
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(id: number, next: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/seller/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (data.success) {
        setStaff((s) => s.map((x) => (x.id === id ? { ...x, isActive: next } : x)));
      } else {
        alert(data.message || "فشل التحديث");
      }
    } catch {
      alert("خطأ في الاتصال");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("هل تريد حذف هذا الموظف؟ ستنتهي كل جلساته فورًا.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/seller/staff/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setStaff((s) => s.filter((x) => x.id !== id));
      } else {
        alert(data.message || "فشل الحذف");
      }
    } catch {
      alert("خطأ في الاتصال");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Users className="h-6 w-6 text-[#ff5c00]" />
            الموظفون
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة حسابات موظفي متجرك وصلاحياتهم
          </p>
        </div>
        <Link
          href="/seller/staff/new"
          className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          إضافة موظف
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm font-bold text-red-700">
          {error}
        </div>
      ) : staff.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <Users className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            لا يوجد موظفون بعد. أضف أول موظف لبدء العمل الجماعي.
          </p>
          <Link
            href="/seller/staff/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة موظف
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((s) => (
            <div
              key={s.id}
              className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${
                s.isActive ? "border-gray-100" : "border-gray-300 opacity-70"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff4ed] text-sm font-black text-[#ff5c00]">
                      {s.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm">{s.name}</strong>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            s.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {s.isActive ? "نشط" : "معطّل"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1" dir="ltr">
                          <Mail className="h-3 w-3" />
                          {s.email}
                        </span>
                        {s.phone && (
                          <span className="flex items-center gap-1" dir="ltr">
                            <Phone className="h-3 w-3" />
                            {s.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    <Shield className="h-3 w-3 text-gray-400" />
                    {s.permissions.length === 0 ? (
                      <span className="text-[10px] text-gray-400">لا صلاحيات</span>
                    ) : (
                      s.permissions.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700"
                        >
                          {p.replace(/_/g, " ")}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Link
                    href={`/seller/staff/${s.id}`}
                    className="flex h-9 items-center gap-1 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    تعديل
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleActive(s.id, !s.isActive)}
                    disabled={busyId === s.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title={s.isActive ? "تعطيل" : "تفعيل"}
                  >
                    {busyId === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : s.isActive ? (
                      <UserX className="h-4 w-4" />
                    ) : (
                      <UserCheck className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    disabled={busyId === s.id}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}