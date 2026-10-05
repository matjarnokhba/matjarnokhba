import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();

  if (!current) {
    redirect("/login");
  }

  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-gray-100"
      dir="rtl"
    >
      <AdminSidebar
        userName={current.user.name}
        userRole={current.user.role}
      />
      <main className="min-w-0 overflow-x-hidden lg:mr-64">
        {children}
      </main>
    </div>
  );
}