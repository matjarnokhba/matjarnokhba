"use client";

import { useEffect, useState } from "react";
import {
  Star,
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Clock,
  Package,
} from "lucide-react";

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
  user: { id: number; name: string; email: string };
  product: { id: number; name: string; slug: string };
};

type Stats = {
  pending: number;
  approved: number;
  total: number;
};

type Filter = "PENDING" | "APPROVED" | "ALL";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, total: 0 });
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?filter=${filter}`);
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
  }, [filter]);

  async function handleAction(reviewId: number, action: "approve" | "reject") {
    setActionId(reviewId);
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">إدارة المراجعات</h1>
        <p className="mt-1 text-sm text-gray-500">
          راجع مراجعات العملاء ووافق عليها أو ارفضها
        </p>
      </div>

      {/* الإحصائيات */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-amber-700">{stats.pending}</div>
              <div className="text-xs text-gray-500">قيد المراجعة</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-green-700">{stats.approved}</div>
              <div className="text-xs text-gray-500">موافق عليها</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <div className="text-2xl font-black text-blue-700">{stats.total}</div>
              <div className="text-xs text-gray-500">الإجمالي</div>
            </div>
          </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="mb-4 flex gap-2">
        {(["PENDING", "APPROVED", "ALL"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "PENDING" && "قيد المراجعة"}
            {f === "APPROVED" && "الموافق عليها"}
            {f === "ALL" && "الكل"}
          </button>
        ))}
      </div>

      {/* القائمة */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">📭</div>
          <h3 className="mt-4 text-lg font-black">لا توجد مراجعات</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "PENDING" && "لا توجد مراجعات بانتظار الموافقة"}
            {filter === "APPROVED" && "لا توجد مراجعات موافق عليها بعد"}
            {filter === "ALL" && "لم يقم أي عميل بالتقييم بعد"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-orange-500 text-sm font-black text-white">
                    {review.user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold">{review.user.name}</div>
                    <div className="text-[10px] text-gray-500">{review.user.email}</div>
                  </div>
                </div>

                {review.isApproved ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-bold text-green-700">
                    ✓ موافق عليها
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-700">
                    ⏳ قيد المراجعة
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-1 rounded-full bg-gray-50 px-3 py-1">
                  <Package className="h-3 w-3 text-gray-500" />
                  <span className="text-xs font-bold">{review.product.name}</span>
                </div>

                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= review.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>

                <span className="text-[10px] text-gray-400">
                  {new Date(review.createdAt).toLocaleDateString("ar-MA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              {review.comment && (
                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-7 text-gray-700">
                  {review.comment}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                {!review.isApproved && (
                  <button
                    onClick={() => handleAction(review.id, "approve")}
                    disabled={actionId === review.id}
                    className="flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionId === review.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    موافقة
                  </button>
                )}

                {review.isApproved && (
                  <button
                    onClick={() => handleAction(review.id, "reject")}
                    disabled={actionId === review.id}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {actionId === review.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    إلغاء الموافقة
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}