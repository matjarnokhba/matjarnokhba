import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { LogisticsScopeService } from "@/services/logistics-scope.service";
import {
  canAccessWarehouse,
  hasAnyLogisticsAccess,
  type ResolvedScope,
} from "@/lib/logistics-scope";

export type LogisticsGuardResult =
  | { ok: true; userId: number; role: string; scope: ResolvedScope }
  | { ok: false; response: NextResponse };

/**
 * حارس مركزي للنطاق اللوجستي. لا يغيّر أي route حالياً؛ يُستعمل تدريجياً
 * بعد التحقق الحالي (QR/الدور) وليس بدلاً منه.
 */
export async function requireLogisticsAccess(opts?: {
  warehouseId?: number;
}): Promise<LogisticsGuardResult> {
  const current = await SessionService.getCurrent();
  if (!current) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "غير مصرح" }, { status: 401 }),
    };
  }
  const scope = await LogisticsScopeService.forUser(current.user.id, current.user.role);
  const allowed =
    opts?.warehouseId != null
      ? canAccessWarehouse(scope, opts.warehouseId)
      : hasAnyLogisticsAccess(scope);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 }),
    };
  }
  return { ok: true, userId: current.user.id, role: current.user.role, scope };
}

/** للأدمن/رئيس المنصة فقط (نطاق platform). */
export async function requireLogisticsPlatform(): Promise<LogisticsGuardResult> {
  const r = await requireLogisticsAccess();
  if (!r.ok) return r;
  if (!r.scope.platform) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: "غير مصرح" }, { status: 403 }),
    };
  }
  return r;
}
