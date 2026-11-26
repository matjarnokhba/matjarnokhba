// حذف البيانات الحساسة من أحداث Sentry قبل إرسالها
type Ev = {
  request?: { cookies?: unknown; data?: unknown; headers?: Record<string, string> };
  user?: Record<string, unknown>;
};

const SENSITIVE_HEADERS = ["cookie", "set-cookie", "authorization", "x-forwarded-for", "x-real-ip"];

export function scrubEvent<T extends Ev>(event: T): T {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    const h = event.request.headers;
    if (h) {
      for (const k of Object.keys(h)) {
        if (SENSITIVE_HEADERS.includes(k.toLowerCase())) delete h[k];
      }
    }
  }
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }
  return event;
}

// تحذيرات Node المتكررة ليست أخطاء حقيقية وتستهلك الحصة المجانية
const NOISE = [/ExperimentalWarning/i, /DeprecationWarning/i];

type NoiseEv = {
  message?: string;
  logentry?: { message?: string };
  exception?: { values?: { value?: string }[] };
};

export function isNoise(event: NoiseEv): boolean {
  const texts: (string | undefined)[] = [
    event.message,
    event.logentry?.message,
    ...(event.exception?.values ?? []).map((v) => v.value),
  ];
  return texts.some((t) => typeof t === "string" && NOISE.some((r) => r.test(t)));
}