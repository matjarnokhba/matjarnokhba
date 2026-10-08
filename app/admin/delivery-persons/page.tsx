"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Truck,
  Loader2,
  Users,
  Phone,
  MapPin,
  Package,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Edit3,
  Trash2,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";

type DeliveryPerson = {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  vehicleType: string | null;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  notes: string | null;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  returnCount: number;
  activeOrders: number;
  deliveredOrders: number;
  returnedOrders: number;
  joinedAt: string;
};

type Stats = {
  total: number;
  active: number;
  suspended: number;
  inactive: number;
};

export default function AdminDeliveryPersonsPage() {
  const [persons, setPersons] = useState<DeliveryPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DeliveryPerson | null>(null);
  const [deleting, setDeleting] = useState<DeliveryPerson | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  // ═══ نموذج ═══
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    city: "",
    vehicleType: "",
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/delivery-persons");
      const data = await res.json();
      if (data.success) setPersons(data.persons);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      password: "",
      city: "",
      vehicleType: "",
      notes: "",
    });
    setError("");
    setShowModal(true);
  }

  function openEdit(p: DeliveryPerson) {
    setEditing(p);
    setForm({
      name: p.name,
      email: p.email,
      phone: p.phone,
      password: "",
      city: p.city,
      vehicleType: p.vehicleType || "",
      notes: p.notes || "",
    });
    setError("");
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setProcessing(true);

    try {
      const url = editing
        ? `/api/admin/delivery-persons/${editing.id}`
        : "/api/admin/delivery-persons";
      const method = editing ? "PATCH" : "POST";

      const body: any = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        vehicleType: form.vehicleType.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (!editing) {
        body.email = form.email.trim().toLowerCase();
        body.password = form.password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل الحفظ");
        return;
      }

      setShowModal(false);
      await load();
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setProcessing(true);
    try {
      const res = await fetch(
        `/api/admin/delivery-persons/${deleting.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "فشل الحذف");
        return;
      }
      setDeleting(null);
      await load();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  const stats: Stats = {
    total: persons.length,
    active: persons.filter((p) => p.status === "ACTIVE").length,
    suspended: persons.filter((p) => p.status === "SUSPENDED").length,
    inactive: persons.filter((p) => p.status === "INACTIVE").length,
  };

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
            <Truck className="h-6 w-6 text-[#ff5c00]" />
            أصحاب التوصيل
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            إدارة السائقين وإسناد الطلبات
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          إضافة سائق
        </button>
      </div>

      {/* ═══ الإحصائيات ═══ */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="إجمالي السائقين"
          value={stats.total}
          color="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="نشطون"
          value={stats.active}
          color="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="موقوفون"
          value={stats.suspended}
          color="amber"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="معطّلون"
          value={stats.inactive}
          color="red"
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      {/* ═══ القائمة ═══ */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : persons.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
            <Truck className="h-10 w-10 text-[#ff5c00]" />
          </div>
          <h2 className="mt-5 text-lg font-black">لا يوجد أصحاب توصيل</h2>
          <p className="mt-2 text-sm text-gray-500">
            ابدأ بإضافة أول سائق
          </p>
          <button
            onClick={openCreate}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة سائق
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {persons.map((p) => (
            <div
              key={p.id}
              className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a1f44] to-purple-600 text-lg font-black text-white">
                  {p.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-black">{p.name}</h3>
                    <StatusBadge status={p.status} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                    <MapPin className="h-3 w-3" />
                    {p.city}
                    {p.vehicleType && (
                      <>
                        <span>·</span>
                        <span>{p.vehicleType}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                    <Phone className="h-3 w-3" />
                    <span dir="ltr">{p.phone}</span>
                  </div>
                </div>
              </div>

              {/* الإحصائيات */}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <MiniStat
                  icon={<Package className="h-3 w-3" />}
                  label="نشطة"
                  value={p.activeOrders}
                  color="blue"
                />
                <MiniStat
                  icon={<CheckCircle2 className="h-3 w-3" />}
                  label="مُسلَّمة"
                  value={p.deliveredOrders}
                  color="green"
                />
                <MiniStat
                  icon={<RotateCcw className="h-3 w-3" />}
                  label="مُرتجعة"
                  value={p.returnedOrders}
                  color="red"
                />
              </div>

              {/* الأزرار */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => openEdit(p)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-[11px] font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  <Edit3 className="h-3 w-3" />
                  تعديل
                </button>
                <button
                  onClick={() => setDeleting(p)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ Modal: إضافة/تعديل ═══ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">
                {editing ? "تعديل سائق" : "إضافة سائق جديد"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  الاسم *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              {!editing && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      البريد الإلكتروني *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      dir="ltr"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      كلمة المرور المؤقتة *
                    </label>
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      dir="ltr"
                      placeholder="6 أحرف على الأقل"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                      required
                      minLength={6}
                    />
                    <p className="mt-1 text-[10px] text-gray-500">
                      أعطها للسائق ليغيّرها عند أول دخول
                    </p>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  رقم الهاتف *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  dir="ltr"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  المدينة *
                </label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="مثال: الدار البيضاء"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  نوع المركبة
                </label>
                <input
                  type="text"
                  value={form.vehicleType}
                  onChange={(e) =>
                    setForm({ ...form, vehicleType: e.target.value })
                  }
                  placeholder="دراجة، سيارة، شاحنة..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  ملاحظات
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {editing ? "حفظ التعديلات" : "إضافة"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={processing}
                  className="rounded-lg border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Modal: حذف ═══ */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد الحذف</h3>
            <p className="mt-2 text-sm text-gray-600">
              هل أنت متأكد من حذف "{deleting.name}"؟
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={processing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                نعم، احذف
              </button>
              <button
                onClick={() => setDeleting(null)}
                disabled={processing}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════ مكونات مساعدة ═══════

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "amber" | "red";
  icon: React.ReactNode;
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}
      >
        {icon}
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "green" | "red";
}) {
  const colors = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
  };
  return (
    <div className="rounded-lg bg-gray-50 p-2 text-center">
      <div
        className={`flex items-center justify-center gap-1 text-xs font-black ${colors[color]}`}
      >
        {icon}
        {value}
      </div>
      <div className="mt-0.5 text-[9px] text-gray-500">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const info: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: "نشط", cls: "bg-green-100 text-green-700" },
    SUSPENDED: { label: "موقوف", cls: "bg-amber-100 text-amber-700" },
    INACTIVE: { label: "معطّل", cls: "bg-red-100 text-red-700" },
  };
  const s = info[status] || info.ACTIVE;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}