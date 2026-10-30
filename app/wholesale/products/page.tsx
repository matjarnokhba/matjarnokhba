import { redirect } from "next/navigation";

export default function WholesaleProductsRedirect() {
  redirect("/seller/wholesale/offers");
}