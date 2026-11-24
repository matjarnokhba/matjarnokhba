import { guardSellerPage } from "@/lib/page-guards";
import FlashOffersClient from "./FlashOffersClient";

export const dynamic = "force-dynamic";

export default async function SellerFlashOffersPage() {
  await guardSellerPage({ ownerOnly: true });
  return <FlashOffersClient />;
}