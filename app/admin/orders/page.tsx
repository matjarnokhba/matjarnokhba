import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Eye, ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  PROCESSING: "قيد المعالجة",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  RETURNED: "مرتجع",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-gray-100 text-gray-700",
};

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      items: { select: { id: true } },
    },
  });

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900 lg:text-3xl">
          الطلبات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {orders.length} طلب إجمالاً
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-base font-bold text-gray-700">
            لا توجد طلبات بعد
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            الطلبات الجديدة ستظهر هنا
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">رقم الطلب</th>
                  <th className="px-4 py-3 text-right font-bold">العميل</th>
                  <th className="px-4 py-3 text-right font-bold">المنتجات</th>
                  <th className="px-4 py-3 text-right font-bold">الحالة</th>
                  <th className="px-4 py-3 text-right font-bold">الإجمالي</th>
                  <th className="px-4 py-3 text-right font-bold">التاريخ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="transition hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-black text-gray-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">
                        {order.user.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {order.user.email}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {order.items.length} عنصر
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          STATUS_COLORS[order.status]
                        }`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-black text-[#ff5c00]">
                      {Number(order.total)} د.م
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("ar-MA", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#fff4ed] px-3 py-1.5 text-[11px] font-bold text-[#ff5c00] transition hover:bg-[#ffe7d5]"
                      >
                        <Eye className="h-3 w-3" />
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}