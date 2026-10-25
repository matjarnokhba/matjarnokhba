import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReturnsMonitorPage() {
  const current = await SessionService.getCurrent();
  if (
    !current ||
    (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/login");
  }

  const pendingHandovers = await prisma.refusedHandoverBatch.findMany({
    where: { status: "PENDING" },
    include: {
      driver: { select: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingSellerReturns = await prisma.sellerReturnBatch.findMany({
    where: { status: { in: ["PENDING", "PICKED_UP"] } },
    include: {
      seller: { select: { storeName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8" dir="rtl">
      <h1 className="text-2xl font-black mb-6">مراقبة المرتجعات</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* دفعات السائقين المعلقة */}
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <h2 className="font-black text-lg mb-3">
            📦 دفعات السائقين المعلّقة ({pendingHandovers.length})
          </h2>
          {pendingHandovers.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              لا توجد دفعات معلّقة
            </p>
          ) : (
            <div className="space-y-2">
              {pendingHandovers.map((b) => {
                const ageHours = Math.floor(
                  (now - b.createdAt.getTime()) / (1000 * 60 * 60)
                );
                const isStale = ageHours > 24;
                return (
                  <div
                    key={b.id}
                    className={`rounded-lg border p-3 ${
                      isStale
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-100"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-mono text-sm font-bold">
                          {b.batchCode}
                        </div>
                        <div className="text-xs text-gray-500">
                          {b.driver.user.name} · {b.totalQuantity} منتج
                        </div>
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          isStale ? "text-red-700" : "text-gray-500"
                        }`}
                      >
                        {ageHours}س
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* دفعات التجار المعلقة */}
        <div className="rounded-2xl bg-white shadow-sm p-5">
          <h2 className="font-black text-lg mb-3">
            🏪 دفعات التجار ({pendingSellerReturns.length})
          </h2>
          {pendingSellerReturns.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              لا توجد دفعات معلّقة
            </p>
          ) : (
            <div className="space-y-2">
              {pendingSellerReturns.map((b) => {
                const ageHours = Math.floor(
                  (now - b.createdAt.getTime()) / (1000 * 60 * 60)
                );
                return (
                  <div
                    key={b.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-mono text-sm font-bold">
                          {b.batchNumber}
                        </div>
                        <div className="text-xs text-gray-500">
                          {b.seller.storeName} · {b.totalQuantity} منتج
                        </div>
                      </div>
                      <div className="text-xs font-bold text-gray-500">
                        {b.status === "PICKED_UP" ? "في الطريق" : "بانتظار"}{" "}
                        · {ageHours}س
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}