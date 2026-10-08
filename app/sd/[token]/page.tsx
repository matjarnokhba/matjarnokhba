import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { ShipmentQRService } from "@/services/shipment-qr.service";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function ShipmentTokenRedirectPage({ params }: Props) {
  const { token } = await params;

  // ═══ 1. تحقق من الجلسة ═══
  const current = await SessionService.getCurrent();
  if (!current) {
    redirect(`/login?redirect=/sd/${token}`);
  }

  // ═══ 2. ابحث عن الشحنة بالـ hash ═══
  const shipment = await ShipmentQRService.findByToken(token);
  if (!shipment) {
    redirect("/");
  }

  // ═══ 3. التحقق من العلاقة (Authorization) ═══
  const user = current.user;

  // ═══ ADMIN → صفحة الشحنة ═══
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    redirect(`/admin/shipments/${shipment.id}`);
  }

  // ═══ DELIVERY → صفحة السائق ═══
  if (user.role === "DELIVERY") {
    const person = await prisma.deliveryPerson.findUnique({
      where: { userId: user.id },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!person || person.deletedAt || person.status !== "ACTIVE") {
      redirect("/");
    }

    // ═══ هل الشحنة مُسندة له؟ ═══
    if (shipment.deliveryPersonId === person.id) {
      redirect(`/delivery/shipments/${shipment.id}`);
    }

    // ═══ ليس مُسنداً له → الرئيسية ═══
    redirect("/delivery");
  }

  // ═══ أي دور آخر → الرئيسية ═══
  redirect("/");
}