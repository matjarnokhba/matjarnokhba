import { redirect } from "next/navigation";
import { SessionService } from "@/services/session.service";
import { CollectionBatchService } from "@/services/collection-batch.service";
import BatchQRView from "@/components/qr/BatchQRView";

type Props = {
  params: Promise<{ token: string }>;
};

function toPlain<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (typeof value === "bigint") return value.toString();

      if (
        value !== null &&
        typeof value === "object" &&
        typeof value.toNumber === "function" &&
        typeof value.toFixed === "function"
      ) {
        return value.toNumber();
      }

      return value;
    })
  );
}

export default async function BatchTokenPage({ params }: Props) {
  const { token } = await params;

  const current = await SessionService.getCurrent();

  if (!current) {
    redirect(`/login?redirect=/cb/${encodeURIComponent(token)}`);
  }

  const batch = await CollectionBatchService.findByToken(token);

  if (!batch) {
    redirect("/");
  }

  // ═══ التحقق من الدور ═══
  const role = current.user.role;

  // ADMIN
  if (role === "ADMIN" || role === "SUPER_ADMIN") {
    return <BatchQRView batch={toPlain(batch)} userRole={role} />;
  }

  // WAREHOUSE_MANAGER
  if (role === "WAREHOUSE_MANAGER") {
    return <BatchQRView batch={toPlain(batch)} userRole={role} />;
  }

  // COLLECTOR (المالك)
  if (role === "COLLECTOR" && batch.collectorId === current.user.id) {
    return <BatchQRView batch={toPlain(batch)} userRole={role} />;
  }

  redirect("/");
}