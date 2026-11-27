/* eslint-disable @typescript-eslint/no-explicit-any */
import { compactForLog } from "@/lib/integration-redact";

export async function logIntegration(
  tx: any,
  e: {
    providerId: number;
    externalShipmentId?: number | null;
    direction: "OUTBOUND" | "INBOUND";
    operation: string;
    ok: boolean;
    httpStatus?: number | null;
    durationMs?: number | null;
    request?: unknown;
    response?: unknown;
    error?: string | null;
  }
) {
  await tx.integrationLog.create({
    data: {
      providerId: e.providerId,
      externalShipmentId: e.externalShipmentId ?? null,
      direction: e.direction,
      operation: e.operation,
      ok: e.ok,
      httpStatus: e.httpStatus ?? null,
      durationMs: e.durationMs ?? null,
      request: e.request == null ? undefined : (compactForLog(e.request) as any),
      response: e.response == null ? undefined : (compactForLog(e.response) as any),
      error: e.error ? String(e.error).slice(0, 500) : null,
    },
  });
}