import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import SellerSidebar from "@/components/seller/SellerSidebar";

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

  if (!user.seller) {
    redirect("/seller-onboarding");
  }

  if (
    user.seller.status === "SUSPENDED" ||
    user.seller.status === "CLOSED"
  ) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-gray-50 p-6"
        dir="rtl"
      >
        <div className="max-w-md text-center">
          <div className="text-6xl">🚫</div>
          <h1 className="mt-4 text-2xl font-black text-gray-900">
            حسابك معطّل
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            يرجى التواصل مع الدعم لمعرفة السبب.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden bg-gray-50"
      dir="rtl"
    >
      <SellerSidebar
        storeName={user.seller.storeName}
        storeSlug={user.seller.slug}
        isVerified={user.seller.isVerified}
      />
      <main className="min-w-0 overflow-x-hidden lg:mr-64">
        {children}
      </main>
    </div>
  );
}