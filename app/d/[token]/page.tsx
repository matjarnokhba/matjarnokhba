import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function DeliveryTokenRedirectPage({ params }: Props) {
  const { token } = await params;

  const current = await SessionService.getCurrent();

  if (!current) {
    redirect(`/login?redirect=/d/${token}`);
  }

  if (current.user.role !== "DELIVERY") {
    redirect("/");
  }

  const order = await prisma.order.findFirst({
    where: { deliveryToken: token },
    select: { id: true },
  });

  if (!order) {
    redirect("/delivery");
  }

  redirect(`/delivery/orders/${order.id}`);
}