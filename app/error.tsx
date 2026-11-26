"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center" dir="rtl">
      <div className="text-2xl font-black text-gray-900">حدث خطأ غير متوقع</div>
      <p className="max-w-sm text-sm text-gray-600">
        نعتذر عن ذلك. تم تسجيل المشكلة وسنعمل على إصلاحها. جرّب مرة أخرى.
      </p>
      <button onClick={() => reset()} className="rounded-lg bg-[#ff5c00] px-5 py-2.5 text-sm font-bold text-white">
        إعادة المحاولة
      </button>
    </div>
  );
}