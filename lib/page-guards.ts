import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";

export async function guardSellerPage(
  options: { ownerOnly?: boolean; permission?: string } = {}
) {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) {
    redirect("/login");
  }
  if (options.ownerOnly && !current.user.isSellerOwner) {
    redirect("/seller");
  }
  if (
    options.permission &&
    !current.user.isSellerOwner &&
    !current.user.staffPermissions.includes(options.permission)
  ) {
    redirect("/seller");
  }
  return current;
}
