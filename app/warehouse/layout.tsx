import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import WarehouseSidebar from "@/components/warehouse/WarehouseSidebar";

export default async function WarehouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();

  if (!current) redirect("/login?redirect=/warehouse");

  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <WarehouseSidebar
        userName={current.user.name}
        role={current.user.role}
      />
      <main className="lg:pr-64">{children}</main>
    </div>
  );
}