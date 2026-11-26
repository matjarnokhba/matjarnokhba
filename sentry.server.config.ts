import * as Sentry from "@sentry/nextjs";
import { isNoise, scrubEvent } from "./lib/sentry-scrub";

// يعمل فقط عند وضع SENTRY_DSN. بدونه لا يُرسل شيء.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    // أخطاؤنا تُلتقط في try/catch ثم تُسجَّل بـ console.error؛ نلتقطها منها
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    beforeSend: (event) => (isNoise(event) ? null : scrubEvent(event)),
  });
}