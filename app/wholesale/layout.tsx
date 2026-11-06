import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { WholesaleSidebar } from "@/components/wholesale/WholesaleSidebar";

export default async function WholesaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();

  if (!current) {
    redirect("/login?returnTo=/wholesale");
  }

  const hasRetailStore = !!current.user.seller;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50" dir="rtl">
      <WholesaleSidebar
        userName={current.user.name}
        hasRetailStore={hasRetailStore}
      />
      <main className="min-w-0 overflow-x-hidden pt-14 lg:mr-64 lg:pt-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}