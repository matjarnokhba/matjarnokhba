import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import PrintTrigger from "./PrintTrigger"; // سننشئه في الخطوة التالية

export default async function PosInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current || !current.user.seller) {
    redirect("/login");
  }

  const { id } = await params;
  const saleId = parseInt(id);
  if (isNaN(saleId)) notFound();

  const sale = await prisma.storeSale.findUnique({
    where: { id: saleId, sellerId: current.user.seller.id },
    include: {
      items: {
        include: {
          variant: {
            include: { product: { select: { name: true } } },
          },
        },
      },
      seller: { select: { storeName: true } },
    },
  });

  if (!sale) notFound();

  return (
    <div className="min-h-screen bg-white p-8 print:p-0" dir="rtl">
      <PrintTrigger />
      
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black">{sale.seller.storeName}</h1>
          <p className="text-gray-500 text-sm mt-1">فاتورة بيع داخل المحل</p>
          <p className="text-xs text-gray-400 mt-2">رقم: {sale.receiptNumber}</p>
          <p className="text-xs text-gray-400">التاريخ: {sale.createdAt.toLocaleString("ar-MA")}</p>
        </div>

        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 text-right">المنتج</th>
              <th className="py-2 text-center">الكمية</th>
              <th className="py-2 text-left">السعر</th>
              <th className="py-2 text-left">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2 text-right">{item.variant.product.name}</td>
                <td className="py-2 text-center">{item.quantity}</td>
                <td className="py-2 text-left">{Number(item.unitPrice).toFixed(2)}</td>
                <td className="py-2 text-left">{Number(item.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t-2 border-black pt-4 flex justify-between text-lg font-black">
          <span>الإجمالي</span>
          <span>{Number(sale.totalAmount).toFixed(2)} د.م</span>
        </div>

        {sale.customerName && (
          <div className="mt-8 text-sm">
            <p className="font-bold">اسم العميل: <span className="font-normal">{sale.customerName}</span></p>
            {sale.customerPhone && <p className="font-bold mt-1">الهاتف: <span className="font-normal" dir="ltr">{sale.customerPhone}</span></p>}
          </div>
        )}

        <div className="mt-12 text-center text-xs text-gray-400">
          شكراً لتعاملكم معنا!
        </div>
      </div>
    </div>
  );
}