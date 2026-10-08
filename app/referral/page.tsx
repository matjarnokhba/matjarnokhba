"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  TrendingUp,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useCart } from "@/lib/hooks/useCart";

type ReferredUser = {
  id: number;
  name: string;
  joinedAt: string;
  completed: boolean;
  firstOrderAt: string | null;
  pointsAwarded: number;
};

type Stats = {
  totalInvited: number;
  completed: number;
  pending: number;
  totalPoints: number;
  pointsPerReferral: number;
};

type ReferralData = {
  referralCode: string;
  wasReferred: boolean;
  stats: Stats;
  referredUsers: ReferredUser[];
};

export default function ReferralPage() {
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const { totalCount: cartCount } = useCart();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/referral/me");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const json = await res.json();
        if (!json.success) {
          setError(json.message || "فشل التحميل");
          return;
        }
        setData(json);
      } catch {
        setError("فشل الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // ═══ بناء الرابط ═══
  function getReferralUrl(): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/register?ref=${data?.referralCode || ""}`;
  }

  // ═══ نسخ الكود ═══
  async function copyCode() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  // ═══ نسخ الرابط ═══
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getReferralUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  // ═══ مشاركة ═══
  async function handleShare() {
    const url = getReferralUrl();
    const text = `🎁 انضم إلى متجر نخبة واحصل على مزايا حصرية! استخدم كود الإحالة: ${data?.referralCode}\n${url}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "دعوة صديق — متجر نخبة",
          text,
          url,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        console.error(err);
      }
    }
  }

  if (loading) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={cartCount}
          onCartClick={() => router.push("/")}
        />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
        <TopBar />
        <Header
          search={search}
          onSearchChange={setSearch}
          cartCount={cartCount}
          onCartClick={() => router.push("/")}
        />
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
            {error || "حدث خطأ"}
          </div>
        </div>
        <Footer />
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartClick={() => router.push("/")}
      />

      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          رجوع للحساب
        </Link>

        <h1 className="mb-5 flex items-center gap-2 text-2xl font-black">
          <Users className="h-6 w-6 text-[#ff5c00]" />
          دعوة الأصدقاء
        </h1>

        {/* ═══ بطاقة الرصيد الرئيسية ═══ */}
        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff5c00] via-[#ff7a1a] to-[#8b5cf6] p-6 text-white shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-lg font-black">
                اربح {data.stats.pointsPerReferral} نقطة عن كل صديق
              </div>
              <p className="mt-1 text-xs opacity-90">
                شارك كودك مع أصدقائك. عندما يكمل صديقك أول عملية شراء،
                تحصل على {data.stats.pointsPerReferral} نقطة في حسابك.
              </p>
            </div>
          </div>

          {/* كود الإحالة */}
          <div className="mt-5 rounded-xl bg-white/15 p-4 backdrop-blur">
            <div className="text-[11px] font-bold opacity-90">
              كود الإحالة الخاص بك
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div
                className="flex-1 rounded-lg bg-white/95 px-4 py-3 text-center font-mono text-lg font-black tracking-widest text-[#0a1f44]"
                dir="ltr"
              >
                {data.referralCode}
              </div>
              <button
                onClick={copyCode}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition ${
                  copied ? "bg-green-500 text-white" : "bg-white/20 hover:bg-white/30"
                }`}
                aria-label="نسخ"
              >
                {copied ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* أزرار المشاركة */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={handleShare}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold transition ${
                shared
                  ? "bg-green-500 text-white"
                  : "bg-white text-[#ff5c00] hover:bg-gray-50"
              }`}
            >
              {shared ? (
                <>
                  <Check className="h-4 w-4" />
                  تم النسخ
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  مشاركة
                </>
              )}
            </button>
            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 rounded-lg border-2 border-white/40 bg-white/10 py-3 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <Copy className="h-4 w-4" />
              نسخ الرابط
            </button>
          </div>
        </div>

        {/* ═══ الإحصائيات ═══ */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="إجمالي المدعوين"
            value={data.stats.totalInvited}
            color="blue"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="أكملوا شراء"
            value={data.stats.completed}
            color="green"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="بانتظار الشراء"
            value={data.stats.pending}
            color="amber"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="نقاط الإحالات"
            value={data.stats.totalPoints}
            color="purple"
          />
        </div>

        {/* ═══ كيف يعمل؟ ═══ */}
        <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-base font-black">
            <Gift className="h-5 w-5 text-[#ff5c00]" />
            كيف يعمل النظام؟
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <Step
              number={1}
              title="شارك كودك"
              description="أرسل كود الإحالة أو الرابط لأصدقائك"
            />
            <Step
              number={2}
              title="صديقك يسجّل"
              description="ينشئ حساباً جديداً باستخدام كودك"
            />
            <Step
              number={3}
              title="اربح النقاط"
              description={`عند إتمام أول عملية شراء → ${data.stats.pointsPerReferral} نقطة`}
            />
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            <strong>ملاحظة:</strong> تحصل على النقاط فقط بعد أن يُتم صديقك أول
            عملية شراء مؤهلة. لا تُحسب النقاط بمجرد التسجيل.
          </div>
        </section>

        {/* ═══ قائمة المدعوين ═══ */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-black">
              <Users className="h-5 w-5 text-[#ff5c00]" />
              المدعوون
            </h2>
            {data.referredUsers.length > 0 && (
              <span className="rounded-full bg-[#fff4ed] px-2 py-0.5 text-[10px] font-bold text-[#ff5c00]">
                {data.referredUsers.length}
              </span>
            )}
          </div>

          {data.referredUsers.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-4xl">👥</div>
              <p className="mt-2 text-sm text-gray-500">
                لم تدعُ أي صديق بعد
              </p>
              <p className="mt-1 text-xs text-gray-400">
                شارك كودك وابدأ في كسب النقاط
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${
                      user.completed
                        ? "bg-gradient-to-br from-green-500 to-emerald-600"
                        : "bg-gradient-to-br from-gray-400 to-gray-500"
                    }`}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      انضم في{" "}
                      {new Date(user.joinedAt).toLocaleDateString("ar-MA")}
                    </div>
                  </div>
                  <div className="shrink-0 text-left">
                    {user.completed ? (
                      <div className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-[10px] font-bold text-green-700">
                        <CheckCircle2 className="h-3 w-3" />+{user.pointsAwarded}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                        <Clock className="h-3 w-3" />
                        بانتظار
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Footer />
    </main>
  );
}

// ═══════ مكونات مساعدة ═══════

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "green" | "amber" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
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

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-lg bg-gray-50 p-4">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#ff5c00] text-xs font-black text-white">
        {number}
      </div>
      <div className="text-xs font-black text-gray-900">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-gray-500">
        {description}
      </div>
    </div>
  );
}