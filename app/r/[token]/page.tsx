import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { ReturnShipmentService } from "@/services/return-shipment.service";
import ReturnQRView from "@/components/returns/ReturnQRView";

type Props = {
  params: Promise<{ token: string }>;
};

function toPlain<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (typeof value === "bigint") return value.toString();
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

export default async function ReturnTokenPage({ params }: Props) {
  const { token } = await params;

  const current = await SessionService.getCurrent();
  if (!current) {
    redirect(`/login?redirect=/r/${encodeURIComponent(token)}`);
  }

  // ═══ جرب pickup أولاً ثم delivery ═══
  const pickup = await ReturnShipmentService.findByPickupToken(token);
  const delivery = pickup
    ? null
    : await ReturnShipmentService.findByDeliveryToken(token);

  const shipment = pickup || delivery;
  const isPickup = !!pickup;

  if (!shipment) {
    return (
      <ReturnQRView
        mode="not_found"
        shipment={null}
        userRole={current.user.role}
      />
    );
  }

  return (
    <ReturnQRView
      mode={isPickup ? "pickup" : "delivery"}
      shipment={toPlain(shipment)}
      userRole={current.user.role}
    />
  );
}