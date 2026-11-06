import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { CreateWizard } from "@/components/wholesale/master-products/CreateWizard";

export default async function NewMasterProductPage() {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/master-products/new");

  return <CreateWizard />;
}