import { redirect } from "next/navigation";

export default function DeliveryOrdersRedirect() {
  redirect("/delivery/shipments");
}