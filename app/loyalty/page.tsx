"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Gift,
  Sparkles,
  Loader2,
  ArrowRight,
  Trophy,
  TrendingUp,
  History,
  Lock,
  CheckCircle2,
  Star,
  Package,
  Truck,
  Check,
  ChevronLeft,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { useCart } from "@/lib/hooks/useCart";

// ═══════ الأنواع ═══════
type Tier = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  requiredPoints: number;
  rewardValueMin: number | null;
  rewardValueMax: number | null;
  unlocked: boolean;
  unlockedAt: string | null;
};

type Category = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
};

type Reward = {
  id: number;
  tierId: number;
  categoryId: number | null;
  giftProductId: number | null;
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  tier: Tier;
  category: Category | null;
  giftProduct: any | null;
};

type Transaction = {
  id: number;
  type: "EARN" | "REVOKE" | "BONUS" | "ADMIN_ADJUST";
  points: number;
  balanceAfter: number;
  reason: string | null;
  createdAt: string;
};

type LoyaltyData = {
  balance: number;
  totalEarned: number;
  totalRevoked: number;
  settings: any;
  tiers: Tier[];
  categories: Category[];
  transactions: Transaction[];
  rewards: Reward[];
};

export default function LoyaltyPage() {
  const router = useRouter();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectingCategoryFor, setSelectingCategoryFor] = useState<
    number | null
  >(null);
  const [submittingCategory, setSubmittingCategory] = useState(false);

  const { totalCount: cartCount } = useCart();

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/loyalty/me");
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

  async function selectCategory(rewardId: number, categoryId: number) {
    setSubmittingCategory(true);
    try {
      const res = await fetch(`/api/loyalty/rewards/${rewardId}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const json = await res.json();
      if (json.success) {
        // تحديث محلي
        setData((prev) =>
          prev
            ? {
                ...prev,
                rewards: prev.rewards.map((r) =>
                  r.id === rewardId
                    ? {
                        ...r,
                        categoryId,
                        category:
                          prev.categories.find((c) => c.id === categoryId) ||
                          null,
                      }
                    : r
                ),
              }
            : null
        );
        setSelectingCategoryFor(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingCategory(false);
    }
  }

  // ═══ الحسابات ═══
  const currentTier = data?.tiers
    .filter((t) => t.unlocked)
    .sort((a, b) => b.requiredPoints - a.requiredPoints)[0];

  const nextTier = data?.tiers
    .filter((t) => !t.unlocked)
    .sort((a, b) => a.requiredPoints - b.requiredPoints)[0];

  const pointsToNext = nextTier
    ? Math.max(0, nextTier.requiredPoints - (data?.balance || 0))
    : 0;

  const progressPercent = nextTier
    ? Math.min(
        100,
        ((data?.balance || 0) / nextTier.requiredPoints) * 100
      )
    : 100;

  const pendingRewards = data?.rewards.filter((r) => r.status === "PENDING") || [];

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <TopBar />
      <Header
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartClick={() => router.push("/")}
      />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href="/profile"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          رجوع للحساب
        </Link>

        <h1 className="mb-5 flex items-center gap-2 text-2xl font-black">
          <Gift className="h-6 w-6 text-[#ff5c00]" />
          برنامج الولاء
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-6 text-center text-red-700">
            {error}
          </div>
        ) : !data ? null : (
          <>
            {/* ═══════ بطاقة الرصيد ═══════ */}
            <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-[#ff5c00] via-[#ff7a1a] to-[#8b5cf6] p-6 text-white shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold opacity-90">
                    <Sparkles className="h-4 w-4" />
                    رصيدك الحالي
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-black leading-none">
                      {data.balance}
                    </span>
                    <span className="pb-1 text-sm font-bold opacity-90">
                      نقطة
                    </span>
                  </div>
                  {currentTier && (
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                      <span>{currentTier.icon || "🎁"}</span>
                      {currentTier.name}
                    </div>
                  )}
                </div>

                <div className="text-left">
                  <div className="text-[11px] font-bold opacity-80">
                    إجمالي المكتسب
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-lg font-black">
                    <TrendingUp className="h-4 w-4" />
                    {data.totalEarned}
                  </div>
                  {data.totalRevoked > 0 && (
                    <>
                      <div className="mt-2 text-[11px] font-bold opacity-80">
                        المسحوب
                      </div>
                      <div className="text-sm font-bold">
                        -{data.totalRevoked}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* شريط التقدم للمستوى التالي */}
              {nextTier && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      التالي: {nextTier.icon} {nextTier.name}
                    </span>
                    <span className="opacity-90">
                      باقي {pointsToNext} نقطة
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full bg-white transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {!nextTier && (
                <div className="mt-5 flex items-center gap-2 rounded-full bg-white/20 px-3 py-2 text-xs font-bold backdrop-blur">
                  <Trophy className="h-4 w-4" />
                  🏆 مبروك! وصلت لأعلى مستوى
                </div>
              )}
            </div>

            {/* ═══════ إرشادات ═══════ */}
            {data.settings?.description && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{data.settings.description}</p>
                </div>
              </div>
            )}

            {/* ═══════ المكافآت بانتظار الفئة ═══════ */}
            {pendingRewards.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                  <Gift className="h-5 w-5 text-[#ff5c00]" />
                  مكافآت تنتظر اختيار الفئة
                </h2>

                {pendingRewards.map((reward) => (
                  <div
                    key={reward.id}
                    className="mb-3 rounded-2xl border-2 border-[#ff5c00] bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fff4ed] to-[#ffe4d3] text-2xl">
                        {reward.tier.icon || "🎁"}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-black">
                          مبروك! فتحت {reward.tier.name}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          اختر فئة الهدية المفضلة لديك، وسيجهز لك فريقنا
                          مفاجأة مناسبة.
                        </p>
                      </div>
                    </div>

                    {reward.categoryId ? (
                      <div className="mt-4 flex items-center gap-2 rounded-lg border-2 border-green-500 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                        <Check className="h-4 w-4" />
                        اخترت: {reward.category?.icon} {reward.category?.name}
                        <span className="mr-auto text-[10px] font-normal">
                          سيتم التواصل معك قريباً
                        </span>
                      </div>
                    ) : selectingCategoryFor === reward.id ? (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-bold text-gray-700">
                          اختر فئة الهدية:
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {data.categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() =>
                                selectCategory(reward.id, cat.id)
                              }
                              disabled={submittingCategory}
                              className="flex flex-col items-center gap-1 rounded-lg border-2 border-gray-200 bg-white p-3 text-[11px] font-bold text-gray-700 transition hover:border-[#ff5c00] hover:bg-[#fff4ed] disabled:opacity-50"
                            >
                              <span className="text-2xl">
                                {cat.icon || "🎁"}
                              </span>
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setSelectingCategoryFor(reward.id)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
                      >
                        <Gift className="h-4 w-4" />
                        اختر فئة الهدية
                      </button>
                    )}
                  </div>
                ))}
              </section>
            )}

            {/* ═══════ المستويات ═══════ */}
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <Trophy className="h-5 w-5 text-[#ff5c00]" />
                المستويات
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {data.tiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={`relative overflow-hidden rounded-2xl border-2 p-5 transition ${
                      tier.unlocked
                        ? "border-[#ff5c00] bg-gradient-to-br from-[#fff4ed] to-white"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    {tier.unlocked && (
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        <CheckCircle2 className="h-3 w-3" />
                        مفتوح
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-3xl ${
                          tier.unlocked
                            ? "bg-gradient-to-br from-[#ff5c00] to-[#8b5cf6]"
                            : "bg-gray-100"
                        }`}
                      >
                        <span className={tier.unlocked ? "" : "grayscale"}>
                          {tier.icon || "🎁"}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-black">{tier.name}</h3>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {tier.description}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <span
                            className={`font-bold ${
                              tier.unlocked
                                ? "text-[#ff5c00]"
                                : "text-gray-500"
                            }`}
                          >
                            {tier.requiredPoints} نقطة
                          </span>
                          {tier.unlockedAt && (
                            <span className="text-[10px] text-gray-400">
                              · فُتح في{" "}
                              {new Date(tier.unlockedAt).toLocaleDateString(
                                "ar-MA"
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ═══════ المكافآت السابقة ═══════ */}
            {data.rewards.filter((r) => r.status !== "PENDING").length > 0 && (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                  <Package className="h-5 w-5 text-[#ff5c00]" />
                  مكافآت قيد التجهيز
                </h2>

                <div className="space-y-2">
                  {data.rewards
                    .filter((r) => r.status !== "PENDING")
                    .map((reward) => (
                      <div
                        key={reward.id}
                        className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff4ed] text-lg">
                          {reward.tier.icon || "🎁"}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold">
                            {reward.tier.name}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {reward.category?.name} ·{" "}
                            {new Date(reward.createdAt).toLocaleDateString(
                              "ar-MA"
                            )}
                          </div>
                        </div>
                        <div
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                            reward.status === "DELIVERED"
                              ? "bg-green-100 text-green-700"
                              : reward.status === "SHIPPED"
                                ? "bg-blue-100 text-blue-700"
                                : reward.status === "CANCELLED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {reward.status === "PROCESSING"
                            ? "قيد التجهيز"
                            : reward.status === "SHIPPED"
                              ? "تم الشحن"
                              : reward.status === "DELIVERED"
                                ? "تم التسليم"
                                : reward.status === "CANCELLED"
                                  ? "ملغى"
                                  : reward.status}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* ═══════ سجل المعاملات ═══════ */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-base font-black">
                <History className="h-5 w-5 text-[#ff5c00]" />
                سجل النقاط
              </h2>

              {data.transactions.length === 0 ? (
                <div className="rounded-xl bg-white p-8 text-center shadow-sm">
                  <div className="text-4xl">📭</div>
                  <p className="mt-2 text-sm text-gray-500">
                    لا توجد معاملات بعد
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    ابدأ التسوق لجمع النقاط!
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                  {data.transactions.map((tx, idx) => {
                    const isPositive = tx.points > 0;
                    return (
                      <div
                        key={tx.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          idx !== data.transactions.length - 1
                            ? "border-b border-gray-50"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${
                            isPositive
                              ? "bg-green-100 text-green-600"
                              : "bg-red-100 text-red-600"
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4 rotate-180" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold">
                            {tx.reason || "معاملة"}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(tx.createdAt).toLocaleDateString(
                              "ar-MA",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <div
                            className={`text-sm font-black ${
                              isPositive ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {tx.points}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            رصيد: {tx.balanceAfter}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}