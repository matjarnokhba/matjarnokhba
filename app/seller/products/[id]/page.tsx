import { guardSellerPage } from "@/lib/page-guards";
import ProductEditClient from "./ProductEditClient";

export default async function Page() {
  await guardSellerPage({ permission: "VIEW_PRODUCTS" });
  return <ProductEditClient />;
}