import { guardSellerPage } from "@/lib/page-guards";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardSellerPage({ permission: "VIEW_WALLET" });
  return <>{children}</>;
}
