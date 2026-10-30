import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";

export default async function WholesaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login");

  const supplier = current.user.wholesaleSupplier;
  if (!supplier) {
    redirect("/wholesale/register");
  }

  return <>{children}</>;
}