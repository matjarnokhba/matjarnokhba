"use client";

import { useState } from "react";
import { Mail, CheckCircle2, Loader2 } from "lucide-react";

// حالة تأكيد البريد الإلكتروني في صفحة الحساب: مؤكد، أو غير مؤكد مع زر إرسال الرابط
export default function EmailVerificationCard({ email, verified: initial }: { email: string; verified: boolean }) {
  const [verified, setVerified] = useState(initial);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/send-verification", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.success && data.alreadyVerified) {
        setVerified(true);
        return;
      }
      if (data?.success) {
        setMsg({
          ok: true,
          text: `أرسلنا الرابط إلى ${data.email}. افتح بريدك (وتفقد الرسائل غير المرغوبة) واضغط الرابط، ثم حدّث هذه الصفحة.`,
        });
      } else {
        setMsg({ ok: false, text: data?.message || "تعذر الإرسال، حاول لاحقاً" });
      }
    } catch {
      setMsg({ ok: false, text: "فشل الاتصال بالخادم" });
    } finally {
      setSending(false);
    }
  }

  if (verified) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800 shadow-sm">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
        <div className="min-w-0">
          <div className="text-sm font-bold">بريدك الإلكتروني مؤكد</div>
          <div className="mt-0.5 truncate text-xs" dir="ltr" style={{ textAlign: "right" }}>{email}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 shadow-sm">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">بريدك الإلكتروني غير مؤكد</div>
          <div className="mt-0.5 truncate text-xs" dir="ltr" style={{ textAlign: "right" }}>{email}</div>
          <p className="mt-1.5 text-xs leading-relaxed">
            أكّد بريدك لتتمكن من استعادة كلمة المرور واستلام الإشعارات الهامة.
          </p>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-600 disabled:opacity-60"
          >
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {sending ? "جارٍ الإرسال..." : "أرسل رابط التأكيد"}
          </button>
          {msg && (
            <p className={`mt-2 text-xs font-bold ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}