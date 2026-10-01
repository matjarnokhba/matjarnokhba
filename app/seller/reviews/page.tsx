"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Star,
  Search,
  MessageSquare,
  CheckCircle2,
  Clock,
  Package,
} from "lucide-react";

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
  user: { name: string };
  product: { id: number; name: string; slug: string };
};

type Stats = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  total: number;
  avg: number;
};

type Filter = "ALL" | "APPROVED" | "PENDING";

export default function SellerReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    total: 0,
    avg: 0,
  });
  const [filter, setFilter] = useState<Filter>("ALL");
  const [ratingFilter, setRatingFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("filter", filter);
      if (ratingFilter !== "ALL") params.set("rating", ratingFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/seller/reviews?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
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
  }, [filter, ratingFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") loadData();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">التقييمات</h1>
        <p className="mt-1 text-sm text-gray-500">
          تقييمات عملائك على منتجاتك
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        {/* المتوسط */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="text-4xl font-black text-[#ff5c00]">
              {stats.avg.toFixed(1)}
            </div>
            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`h-4 w-4 ${
                    s <= Math.round(stats.avg)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              من {stats.total} مراجعة
            </div>
          </div>
        </div>

        {/* الرسم البياني */}
        <div className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = stats[stars as keyof Stats] as number;
              const percent =
                stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <button
                  key={stars}
                  onClick={() =>
                    setRatingFilter(
                      ratingFilter === String(stars) ? "ALL" : String(stars)
                    )
                  }
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition ${
                    ratingFilter === String(stars)
                      ? "bg-amber-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="flex w-8 items-center gap-0.5 font-bold">
                    {stars}
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-yellow-400"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-12 text-left text-gray-500">
                    {count} ({percent}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث في المراجعات أو المنتجات..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["ALL", "الكل"],
            ["APPROVED", "منشورة"],
            ["PENDING", "بانتظار الموافقة"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}

        {ratingFilter !== "ALL" && (
          <button
            onClick={() => setRatingFilter("ALL")}
            className="flex items-center gap-1 rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-700"
          >
            ⭐ {ratingFilter} نجوم
            <span className="text-amber-500">✕</span>
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 text-lg font-black">لا توجد تقييمات</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "ALL"
              ? "لم يقيّم عملاؤك أي منتج بعد"
              : filter === "PENDING"
                ? "لا توجد تقييمات بانتظار الموافقة"
                : "لا توجد تقييمات منشورة"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                {/* المستخدم */}
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-500 text-xs font-black text-white">
                    {review.user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">
                      {review.user.name}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {/* الحالة */}
                {review.isApproved ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[10px] font-bold text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    منشورة
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
                    <Clock className="h-3 w-3" />
                    بانتظار الموافقة
                  </span>
                )}
              </div>

              {/* المنتج + التقييم */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                <Link
                  href={`/seller/products/${review.product.id}`}
                  className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1 transition hover:bg-gray-100"
                >
                  <Package className="h-3 w-3 text-gray-500" />
                  <span className="text-xs font-bold text-gray-700">
                    {review.product.name}
                  </span>
                </Link>

                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`h-4 w-4 ${
                        s <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* التعليق */}
              {review.comment && (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-7 text-gray-700">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}