"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Loader2,
  Search,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Phone,
  ShoppingBag,
  Crown,
} from "lucide-react";

type User = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
  _count: { orders: number };
};

type Stats = {
  CUSTOMER: number;
  ADMIN: number;
  SUPER_ADMIN: number;
  total: number;
};

type RoleFilter = "ALL" | "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";

const ROLE_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  CUSTOMER: {
    label: "عميل",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: UserIcon,
  },
  ADMIN: {
    label: "مدير",
    color: "text-purple-700",
    bg: "bg-purple-100",
    icon: ShieldCheck,
  },
  SUPER_ADMIN: {
    label: "مدير عام",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: Crown,
  },
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats>({
    CUSTOMER: 0,
    ADMIN: 0,
    SUPER_ADMIN: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<RoleFilter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("role", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // بحث مع تأخير (debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") loadData();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">المستخدمون</h1>
        <p className="mt-1 text-sm text-gray-500">
          عرض وإدارة جميع مستخدمي المتجر
        </p>
      </div>

      {/* ═══ الإحصائيات ═══ */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-gray-900">
            {stats.total}
          </div>
          <div className="mt-1 text-xs text-gray-500">الإجمالي</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-blue-700">
            {stats.CUSTOMER}
          </div>
          <div className="mt-1 text-xs text-gray-500">عملاء</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-purple-700">
            {stats.ADMIN}
          </div>
          <div className="mt-1 text-xs text-gray-500">مدراء</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-2xl font-black text-amber-700">
            {stats.SUPER_ADMIN}
          </div>
          <div className="mt-1 text-xs text-gray-500">مدير عام</div>
        </div>
      </div>

      {/* ═══ البحث ═══ */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو البريد أو الهاتف..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* ═══ الفلاتر ═══ */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(["ALL", "CUSTOMER", "ADMIN", "SUPER_ADMIN"] as RoleFilter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                filter === f
                  ? "bg-[#ff5c00] text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "ALL" && "الكل"}
              {f === "CUSTOMER" && "العملاء"}
              {f === "ADMIN" && "المدراء"}
              {f === "SUPER_ADMIN" && "المدير العام"}
            </button>
          )
        )}
      </div>

      {/* ═══ القائمة ═══ */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">👥</div>
          <h3 className="mt-4 text-lg font-black">لا يوجد مستخدمون</h3>
          <p className="mt-2 text-sm text-gray-500">
            لم يُطابق البحث أي مستخدم
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const info = ROLE_INFO[user.role];
            const Icon = info.icon;

            return (
              <div
                key={user.id}
                className="rounded-xl bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* الأفاتار */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-500 text-lg font-black text-white">
                    {user.name.charAt(0)}
                  </div>

                  {/* المعلومات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-gray-900">
                        {user.name}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {user.email}
                      </span>
                      {user.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{user.phone}</span>
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <ShoppingBag className="h-3 w-3" />
                        {user._count.orders} طلب
                      </span>
                      <span>
                        انضم:{" "}
                        {new Date(user.createdAt).toLocaleDateString("ar-MA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}