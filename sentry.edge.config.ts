import * as Sentry from "@sentry/nextjs";
import { isNoise, scrubEvent } from "./lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend: (event) => (isNoise(event) ? null : scrubEvent(event)),
  });
}