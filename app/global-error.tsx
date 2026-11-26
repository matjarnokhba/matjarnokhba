"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          fontFamily: "sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900 }}>حدث خطأ غير متوقع</div>
        <p style={{ maxWidth: 360, fontSize: 14, color: "#555" }}>نعتذر عن ذلك. تم تسجيل المشكلة. أعد تحميل الصفحة.</p>
        <button
          onClick={() => window.location.reload()}
          style={{ background: "#ff5c00", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 700 }}
        >
          إعادة التحميل
        </button>
      </body>
    </html>
  );
}