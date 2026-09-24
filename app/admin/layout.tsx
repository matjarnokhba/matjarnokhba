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

  // غير مسجل دخول
  if (!current) {
    redirect("/login");
  }

  // ليس Admin
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-100" dir="rtl">
      <div className="flex">
        <AdminSidebar
          userName={current.user.name}
          userRole={current.user.role}
        />

        <main className="flex-1 overflow-x-hidden lg:mr-64">
          {children}
        </main>
      </div>
    </div>
  );
}