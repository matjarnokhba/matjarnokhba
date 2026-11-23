import { redirect } from "next/navigation";
import { guardSellerPage } from "@/lib/page-guards";

// قائمة المنتجات متاحة لمن يملك عرض المنتجات أو إضافة المخزون
const ALLOWED = ["VIEW_PRODUCTS", "ADD_STOCK"];

export default async function Layout({ children }: { children: React.ReactNode }) {
  const current = await guardSellerPage();
  if (!current.user.isSellerOwner && !ALLOWED.some((k) => current.user.staffPermissions.includes(k))) {
    redirect("/seller");
  }
  return <>{children}</>;
}