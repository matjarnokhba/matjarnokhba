import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { QRRoutingService } from "@/services/qr-routing.service";
import OrderQRView from "@/components/qr/OrderQRView";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function OrderTokenPage({ params }: Props) {
  const { token } = await params;

  const current = await SessionService.getCurrent();

  const result = await QRRoutingService.resolveOrderToken(token, current);

  if (result.redirect) {
    redirect(result.redirect);
  }

  return <OrderQRView result={result} />;
}