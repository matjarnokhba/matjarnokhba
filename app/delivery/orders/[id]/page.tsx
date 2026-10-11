import { redirect } from "next/navigation";

export default function DeliveryOrderDetailRedirect() {
  redirect("/delivery/shipments");
}