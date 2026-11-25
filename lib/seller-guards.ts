import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";

export type SellerGuardResult =
  | {
      ok: true;
      current: NonNullable<Awaited<ReturnType<typeof SessionService.getCurrent>>>;
    }
  | { ok: false; response: NextResponse };

// تاجر موقوف أو مغلق: يُمنع من العمليات (السحب، البنوك، العروض...). PENDING يبقى مسموحاً لمرحلة التسجيل.
export function isSellerDisabled(status: string | null | undefined): boolean {
  return status === "SUSPENDED" || status === "CLOSED";
}

function disabledResponse(): SellerGuardResult {
  return {
    ok: false,
    response: NextResponse.json(
      { success: false, message: "متجرك معطّل. تواصل مع الإدارة." },
      { status: 403 }
    ),
  };
}

export async function requireSeller(): Promise<SellerGuardResult> {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      ),
    };
  }
  return { ok: true, current };
}

export async function requireSellerOwner(): Promise<SellerGuardResult> {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      ),
    };
  }
  if (isSellerDisabled(current.user.seller.status)) return disabledResponse();
  if (!current.user.isSellerOwner) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "هذه العملية متاحة لصاحب المتجر فقط",
        },
        { status: 403 }
      ),
    };
  }
  return { ok: true, current };
}

export async function requireStaffPermission(
  permissionKey: string
): Promise<SellerGuardResult> {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      ),
    };
  }
  if (isSellerDisabled(current.user.seller.status)) return disabledResponse();
  if (current.user.isSellerOwner) {
    return { ok: true, current };
  }
  if (!current.user.staffPermissions.includes(permissionKey)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "لا تملك الصلاحية لهذه العملية" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, current };
}