import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import SellerSidebar from "@/components/seller/SellerSidebar";
import RoleTopBar from "@/components/layout/RoleTopBar";

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
  const hasWholesaleAccess = !!user.wholesaleSupplier;

  // Neither retail nor wholesale → onboarding
  if (!hasRetailStore && !hasWholesaleAccess && !isAdminViewing) {
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

  // Wholesale-only user (no retail store)
  if (!hasRetailStore && hasWholesaleAccess) {
    const ws = user.wholesaleSupplier!;
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-gray-50" dir="rtl">
        {/* Minimal layout for wholesale-only users */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-black text-white">
              ج
            </span>
            <div className="leading-none">
              <strong className="block text-sm font-black">{ws.displayName}</strong>
              <small className="text-[10px] text-gray-500">بوابة الجملة</small>
            </div>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              ws.status === "ACTIVE"
                ? "bg-green-100 text-green-700"
                : ws.status === "PENDING"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {ws.status === "ACTIVE" ? "موثق" : ws.status === "PENDING" ? "بانتظار" : "موقوف"}
          </span>
        </header>
        <main className="min-w-0 overflow-x-hidden">{children}</main>
      </div>
    );
  }

  // Full seller (retail + optional wholesale)
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
    </div>
  );
}