import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { QRRoutingService } from "@/services/qr-routing.service";
import OrderQRView from "@/components/qr/OrderQRView";

type Props = {
  params: Promise<{ token: string }>;
};

// ═══════════════════════════════════════════
// Serialize Prisma objects (Decimal, BigInt) → plain JSON
// ═══════════════════════════════════════════
function toPlain<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (typeof value === "bigint") return value.toString();

      // Prisma Decimal
      if (
        value !== null &&
        typeof value === "object" &&
        typeof value.toNumber === "function" &&
        typeof value.toFixed === "function"
      ) {
        return value.toNumber();
      }

      return value;
    })
  );
}

export default async function OrderTokenPage({ params }: Props) {
  const { token } = await params;

  const current = await SessionService.getCurrent();

  const result = await QRRoutingService.resolveOrderToken(token, current);

  if (result.redirect) {
    redirect(result.redirect);
  }

  return <OrderQRView result={toPlain(result)} />;
}