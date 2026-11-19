import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";

export type DeliveryPersonContext = {
  id: number;
  status: string;
  isOnline: boolean;
};

export type RequireDeliveryPersonResult =
  | { ok: true; user: { id: number; name: string; role: string }; deliveryPerson: DeliveryPersonContext }
  | { ok: false; status: 401 | 403; error: string };

export async function requireDeliveryPerson(): Promise<RequireDeliveryPersonResult> {
  const current = await SessionService.getCurrent();
  if (!current) {
    return { ok: false, status: 401, error: "غير مصرح" };
  }
  if (current.user.role !== "DELIVERY") {
    return { ok: false, status: 403, error: "غير مصرح — حسابك ليس حساب سائق" };
  }

  const dp = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true, isOnline: true },
  });

  if (!dp || dp.deletedAt || dp.status !== "ACTIVE") {
    return { ok: false, status: 403, error: "حساب السائق غير مفعّل" };
  }

  return {
    ok: true,
    user: { id: current.user.id, name: current.user.name, role: current.user.role },
    deliveryPerson: { id: dp.id, status: dp.status, isOnline: dp.isOnline },
  };
}