import { redirect } from "next/navigation";
import Link from "next/link";
import { SessionService } from "@/services/session.service";
import SellerSidebar from "@/components/seller/SellerSidebar";
import RoleTopBar from "@/components/layout/RoleTopBar";
import { WholesaleQuickAccess } from "@/components/wholesale/WholesaleQuickAccess";

export default async function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();

  if (!current) redirect("/login");

  const { user } = current;

  if (
    user.role !== "SELLER" &&
    user.role !== "ADMIN" &&
    user.role !== "SUPER_ADMIN"
  ) {
    redirect("/");
  }

  const isAdminViewing =
    user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  const hasRetailStore = !!user.seller;

  // Neither retail nor admin → onboarding
  if (!hasRetailStore && !isAdminViewing) {
    redirect("/seller-onboarding");
  }

  // Retail store suspended/closed
  if (
    hasRetailStore &&
    (user.seller!.status === "SUSPENDED" || user.seller!.status === "CLOSED")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6" dir="rtl">
        <div className="max-w-md text-center">
          <div className="text-6xl">🚫</div>
          <h1 className="mt-4 text-2xl font-black text-gray-900">حسابك معطّل</h1>
          <p className="mt-2 text-sm text-gray-500">يرجى التواصل مع الدعم لمعرفة السبب.</p>
        </div>
      </div>
    );
  }



  // Full seller (retail)
  const topbarItems = [
    {
      countKey: "ordersNew",
      label: "طلبات جديدة",
      href: "/seller/orders",
      icon: "orders" as const,
    },
    {
      countKey: "fulfillmentsPending",
      label: "تجهيزات قيد الانتظار",
      href: "/seller/fulfillments",
      icon: "fulfillments" as const,
    },
    {
      countKey: "returnsToConfirm",
      label: "مرتجعات بانتظار التأكيد",
      href: "/seller/returns",
      icon: "returns" as const,
    },
    {
      countKey: "batchesToConfirm",
      label: "دفعات من المستودع",
      href: "/seller/returns-batches",
      icon: "batches" as const,
    },
    {
      countKey: "wholesaleOrdersIncoming",
      label: "طلبات جملة واردة",
      href: "/wholesale/orders?direction=seller",
      icon: "orders" as const,
    },
    {
      countKey: "wholesaleReturnsPending",
      label: "مرتجعات جملة",
      href: "/wholesale/returns?direction=seller",
      icon: "returns" as const,
    },
  ];

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50" dir="rtl">
      <SellerSidebar
        storeName={user.seller!.storeName}
        storeSlug={user.seller!.slug}
        isVerified={user.seller!.isVerified}
        isSellerOwner={user.isSellerOwner}
        staffPermissions={user.staffPermissions}
      />
      <RoleTopBar
        endpointUrl="/api/seller/topbar"
        readAllUrl="/api/seller/notifications/read-all"
        allNotifsHref="/seller/notifications"
        items={topbarItems}
      />
      <main className="min-w-0 overflow-x-hidden pt-14 lg:mr-64">
        {children}
      </main>
      <WholesaleQuickAccess />
    </div>
  );
}