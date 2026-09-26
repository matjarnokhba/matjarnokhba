"use client";

import { useState } from "react";
import { Star, X, Loader2 } from "lucide-react";

type ReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderItemId: number;
  productName: string;
  productImage: string | null;
};

export default function ReviewModal({
  isOpen,
  onClose,
  onSuccess,
  orderItemId,
  productName,
  productImage,
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  async function handleSubmit() {
    setError("");

    if (rating < 1) {
      setError("اختر تقييماً من 1 إلى 5 نجوم");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderItemId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "فشل إرسال المراجعة");
        setLoading(false);
        return;
      }

      onSuccess();
    } catch {
      setError("فشل الاتصال بالخادم");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        {/* رأس */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">قيّم المنتج</h3>
          <button
            onClick={onClose}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* المنتج */}
        <div className="mb-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-sm font-bold">{productName}</div>
          </div>
        </div>

        {/* التقييم بالنجوم */}
        <div className="mb-4 text-center">
          <div className="mb-2 text-xs font-bold text-gray-600">
            ما هو تقييمك؟
          </div>
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                disabled={loading}
                className="transition hover:scale-110 disabled:opacity-50"
              >
                <Star
                  className={`h-9 w-9 ${
                    star <= (hovered || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <div className="mt-2 text-xs font-bold text-[#ff5c00]">
              {rating === 1 && "سيء"}
              {rating === 2 && "مقبول"}
              {rating === 3 && "جيد"}
              {rating === 4 && "جيد جداً"}
              {rating === 5 && "ممتاز"}
            </div>
          )}
        </div>

        {/* التعليق */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-bold text-gray-700">
            تعليقك (اختياري)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            disabled={loading}
            placeholder="شاركنا تجربتك مع المنتج..."
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
          />
          <div className="mt-1 text-left text-[10px] text-gray-400">
            {comment.length} / 1000
          </div>
        </div>

        {/* خطأ */}
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* أزرار */}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={loading || rating < 1}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              "إرسال المراجعة"
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-gray-400">
          ستظهر مراجعتك بعد الموافقة عليها من الإدارة
        </p>
      </div>
    </div>
  );
}