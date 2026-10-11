import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import CollectorSidebar from "@/components/collector/CollectorSidebar";

export default async function CollectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();

  if (!current) redirect("/login?redirect=/collector");

  if (current.user.role !== "COLLECTOR" && current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CollectorSidebar
        userName={current.user.name}
        role={current.user.role}
      />
      <main className="lg:pr-64">{children}</main>
    </div>
  );
}