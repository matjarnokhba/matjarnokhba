import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import DeliverySidebar from "@/components/delivery/DeliverySidebar";

export default async function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login");

  if (current.user.role !== "DELIVERY") {
    redirect("/");
  }

  const deliveryPerson = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: {
      id: true,
      city: true,
      status: true,
      deletedAt: true,
    },
  });

  if (
    !deliveryPerson ||
    deliveryPerson.deletedAt ||
    deliveryPerson.status !== "ACTIVE"
  ) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#f7f6f2]" dir="rtl">
      <DeliverySidebar
        userName={current.user.name}
        city={deliveryPerson.city}
      />
      <main className="lg:mr-64">{children}</main>
    </div>
  );
}