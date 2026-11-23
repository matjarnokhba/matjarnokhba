import { redirect } from "next/navigation";
import { guardSellerPage } from "@/lib/page-guards";

const ALLOWED = ["ADD_STOCK", "APPROVE_STOCK", "VIEW_STOCK_HISTORY"];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const current = await guardSellerPage();
  if (!current.user.isSellerOwner && !ALLOWED.some((k) => current.user.staffPermissions.includes(k))) {
    redirect("/seller");
  }
  return <>{children}</>;
}