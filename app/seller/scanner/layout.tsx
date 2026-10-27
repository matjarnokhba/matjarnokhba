import { guardSellerPage } from "@/lib/page-guards";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await guardSellerPage({ permission: "SELL_ON_POS" });
  return <>{children}</>;
}
