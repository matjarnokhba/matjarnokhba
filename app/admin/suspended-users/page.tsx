"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldOff } from "lucide-react";

type SuspendedUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  suspendedAt: string;
  suspendReason: string | null;
};

export default function SuspendedUsersPage() {
  const [users, setUsers] = useState<SuspendedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/admin/suspended-users");
      const d = await res.json();
      if (d.success) setUsers(d.users);
      else setError(d.message || "فشل التحميل");
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function unsuspend(userId: number) {
    if (!window.confirm("رفع الإيقاف عن هذا الحساب؟")) return;
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/suspended-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) setError(d.message || "فشل الإجراء");
      else await load();
    } catch {
      setError("فشل الاتصال");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
        <ShieldOff className="h-6 w-6 text-red-600" />
        الحسابات الموقوفة
      </h1>
      <p className="text-xs text-gray-500">
        حسابات العملاء الموقوفة بسبب تلاعب. التجار الموقوفون يُدارون من صفحة التجار.
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {users.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          لا توجد حسابات موقوفة.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-black">{u.name}</div>
                  <div className="text-gray-600">{u.email}</div>
                  {u.phone && <div className="text-gray-600">{u.phone}</div>}
                  <div className="mt-1 text-[11px] text-gray-400">
                    أُوقف في {new Date(u.suspendedAt).toLocaleString("ar-MA")}
                  </div>
                </div>
                <button
                  onClick={() => unsuspend(u.id)}
                  disabled={busyId === u.id}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {busyId === u.id ? "..." : "رفع الإيقاف"}
                </button>
              </div>
              {u.suspendReason && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{u.suspendReason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}