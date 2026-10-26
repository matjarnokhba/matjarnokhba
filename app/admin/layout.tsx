import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import AdminSidebar from "@/components/admin/AdminSidebar";
import RoleTopBar from "@/components/layout/RoleTopBar";

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

  const topbarItems = [
    {
      countKey: "sellersPending",
      label: "تجار بانتظار الموافقة",
      href: "/admin/sellers",
      icon: "sellers" as const,
    },
    {
      countKey: "productsPending",
      label: "منتجات بانتظار الموافقة",
      href: "/admin/products/pending",
      icon: "products" as const,
    },
    {
      countKey: "documentsPending",
      label: "وثائق بانتظار المراجعة",
      href: "/admin/documents",
      icon: "documents" as const,
    },
    {
      countKey: "bankAccountsPending",
      label: "حسابات بنكية بانتظار التحقق",
      href: "/admin/bank-accounts",
      icon: "banks" as const,
    },
    {
      countKey: "withdrawalsPending",
      label: "طلبات سحب",
      href: "/admin/withdrawals",
      icon: "withdrawals" as const,
    },
    {
      countKey: "legalNoticesActive",
      label: "إنذارات قانونية نشطة",
      href: "/admin/legal-notices",
      icon: "legal" as const,
    },
    {
      countKey: "handoverPending",
      label: "استلام كاش من المستودع",
      href: "/admin/handover",
      icon: "handover" as const,
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-100" dir="rtl">
      <AdminSidebar
        userName={current.user.name}
        userRole={current.user.role}
      />
      <RoleTopBar
        endpointUrl="/api/admin/topbar"
        readAllUrl="/api/admin/notifications/read-all"
        allNotifsHref="/admin/notifications"
        items={topbarItems}
      />
      <main className="min-w-0 overflow-x-hidden pt-14 lg:mr-64">
        {children}
      </main>
    </div>
  );
}