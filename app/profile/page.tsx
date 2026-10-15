"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  User,
  Phone,
  Mail,
  Package,
  Truck,
  Heart,
  Star,
  MapPin,
  Gift,
  Tag,
  Users,
  HelpCircle,
  MessageCircle,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  Edit3,
} from "lucide-react";

type UserData = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
};

type OrderStats = {
  total: number;
  active: number;
  delivered: number;
};

type LoyaltyStats = {
  balance: number;
  tier: string | null;
};

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    active: 0,
    delivered: 0,
  });
  const [loyaltyStats, setLoyaltyStats] = useState<LoyaltyStats>({
    balance: 0,
    tier: null,
  });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, ordersRes, loyaltyRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/orders"),
          fetch("/api/loyalty/me").catch(() => null),
        ]);

        const meData = await meRes.json();
        if (!meData.success) {
          router.push("/login");
          return;
        }
        setUser(meData.user);

        const ordersData = await ordersRes.json();
        if (ordersData.success && ordersData.orders) {
          const orders = ordersData.orders;
          setOrderStats({
            total: orders.length,
            active: orders.filter((o: any) =>
              ["NEW", "PROCESSING", "SHIPPED", "PARTIALLY_DELIVERED"].includes(
                o.status
              )
            ).length,
            delivered: orders.filter((o: any) => o.status === "DELIVERED")
              .length,
          });
        }

        if (loyaltyRes) {
          const loyaltyData = await loyaltyRes.json();
          if (loyaltyData.success) {
            setLoyaltyStats({
              balance: loyaltyData.account?.balance || 0,
              tier: loyaltyData.currentTier?.name || null,
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.dispatchEvent(new CustomEvent("nokhba:auth-changed"));
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (!user) return null;

  const isSeller = user.role === "SELLER";
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ═══════ Header Card ═══════ */}
      <div className="bg-gradient-to-br from-[#ff5c00] to-[#e64a00] px-4 pb-20 pt-16 text-white lg:pt-8">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-2xl font-black backdrop-blur">
            {user.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-black">{user.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs opacity-90">
              <Phone className="h-3 w-3" />
              <span dir="ltr">{user.phone || "—"}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs opacity-90">
              <Mail className="h-3 w-3" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-3xl">
          <Link
            href="/profile/edit"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-xs font-bold backdrop-blur transition hover:bg-white/30"
          >
            <Edit3 className="h-3.5 w-3.5" />
            تعديل الملف الشخصي
          </Link>
        </div>
      </div>

      {/* ═══════ Quick Stats (Floating) ═══════ */}
      <div className="-mt-14 px-4">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-3">
          <Link
            href="/orders"
            className="rounded-2xl bg-white p-4 text-center shadow-md transition hover:shadow-lg"
          >
            <div className="text-2xl font-black text-[#ff5c00]">
              {orderStats.total}
            </div>
            <div className="mt-1 text-[10px] font-bold text-gray-500">
              طلباتي
            </div>
          </Link>
          <Link
            href="/orders?filter=active"
            className="rounded-2xl bg-white p-4 text-center shadow-md transition hover:shadow-lg"
          >
            <div className="text-2xl font-black text-blue-600">
              {orderStats.active}
            </div>
            <div className="mt-1 text-[10px] font-bold text-gray-500">
              نشطة
            </div>
          </Link>
          <Link
            href="/loyalty"
            className="rounded-2xl bg-white p-4 text-center shadow-md transition hover:shadow-lg"
          >
            <div className="text-2xl font-black text-purple-600">
              {loyaltyStats.balance}
            </div>
            <div className="mt-1 text-[10px] font-bold text-gray-500">
              نقاط
            </div>
          </Link>
        </div>
      </div>

      {/* ═══════ Sections ═══════ */}
      <div className="mx-auto mt-6 max-w-3xl space-y-4 px-4">
        {/* ═══ التسوق ═══ */}
        <Section title="التسوق 🛒">
          <MenuItem
            href="/orders"
            icon={Package}
            label="طلباتي"
            badge={orderStats.total > 0 ? orderStats.total : undefined}
            color="text-[#ff5c00]"
          />
          <MenuItem
            href="/orders?filter=active"
            icon={Truck}
            label="تتبع الطلبات"
            badge={orderStats.active > 0 ? orderStats.active : undefined}
            color="text-blue-600"
          />
          <MenuItem
            href="/favorites"
            icon={Heart}
            label="المفضلة"
            color="text-red-500"
          />
          <MenuItem
            href="/profile/reviews"
            icon={Star}
            label="تقييماتي"
            color="text-amber-500"
          />
        </Section>

        {/* ═══ حسابي ═══ */}
        <Section title="حسابي 👤">
          <MenuItem
            href="/profile/addresses"
            icon={MapPin}
            label="عناوين التوصيل"
            color="text-teal-600"
          />
          <MenuItem
            href="/profile/edit"
            icon={User}
            label="معلوماتي الشخصية"
            color="text-indigo-600"
          />
          <MenuItem
            href="/loyalty"
            icon={Gift}
            label="نقاطي ومكافآتي"
            badge={loyaltyStats.balance > 0 ? loyaltyStats.balance : undefined}
            color="text-purple-600"
          />
          <MenuItem
            href="/profile/coupons"
            icon={Tag}
            label="كوبوناتي"
            color="text-pink-600"
          />
          <MenuItem
            href="/referral"
            icon={Users}
            label="دعوة الأصدقاء"
            color="text-green-600"
          />
        </Section>

        {/* ═══ المساعدة ═══ */}
        <Section title="المساعدة ❓">
          <MenuItem
            href="/help"
            icon={HelpCircle}
            label="مركز المساعدة"
            color="text-gray-600"
          />
          <MenuItem
            href="/contact"
            icon={MessageCircle}
            label="التواصل معنا"
            color="text-blue-500"
          />
          <MenuItem
            href="/terms"
            icon={FileText}
            label="الشروط والخصوصية"
            color="text-gray-500"
          />
        </Section>

        {/* ═══ إدارة (فقط للتاجر/الأدمن) ═══ */}
        {(isSeller || isAdmin) && (
          <Section title="إدارة ⚙️">
            {isSeller && (
              <MenuItem
                href="/seller"
                icon={Package}
                label="لوحة التاجر"
                color="text-orange-600"
              />
            )}
            {isAdmin && (
              <MenuItem
                href="/admin"
                icon={Settings}
                label="لوحة الإدارة"
                color="text-purple-700"
              />
            )}
          </Section>
        )}

        {/* ═══ الإعدادات + خروج ═══ */}
        <Section title="الإعدادات ⚙️">
          <MenuItem
            href="/profile/settings"
            icon={Settings}
            label="الإعدادات"
            color="text-gray-600"
          />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-right transition hover:bg-red-50 disabled:opacity-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50">
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin text-red-600" />
              ) : (
                <LogOut className="h-4 w-4 text-red-600" />
              )}
            </div>
            <span className="flex-1 text-sm font-bold text-red-600">
              {loggingOut ? "جاري الخروج..." : "تسجيل الخروج"}
            </span>
          </button>
        </Section>

        {/* Footer */}
        <div className="py-6 text-center text-[10px] text-gray-400">
          متجر نخبة · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}

// ═══════ Helpers ═══════

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="text-xs font-black text-gray-700">{title}</div>
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
  badge,
  color,
}: {
  href: string;
  icon: any;
  label: string;
  badge?: number;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-right transition hover:bg-gray-50"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50">
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <span className="flex-1 text-sm font-bold text-gray-800">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-[10px] font-black text-[#ff5c00]">
          {badge}
        </span>
      )}
      <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}