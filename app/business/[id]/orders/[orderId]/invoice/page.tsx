"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Printer, ArrowLeft } from "lucide-react";

type OrderItem = {
  id: number;
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  masterVariant: { options: any };
};

type Order = {
  id: number;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  total: number;
  currency: string;
  notes: string | null;
  trackingNumber: string | null;
  shippingCarrier: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  createdAt: string;
  buyerBusiness: { id: number; name: string; slug: string; city: string };
  sellerBusiness: { id: number; name: string; slug: string; city: string };
  items: OrderItem[];
};

type Payment = { id: number; amount: number; status: string; createdAt: string; createdBy: { name: string } };
type Payments = { payments: Payment[]; summary: { total: number; totalPaid: number; remaining: number } };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار القبول", ACCEPTED: "مقبول", PREPARING: "قيد التجهيز",
  SHIPPED: "تم الشحن", DELIVERED: "تم التسليم", COMPLETED: "مكتمل",
  REJECTED: "مرفوض", CANCELLED: "ملغى",
};

export default function InvoicePage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);
  const orderId = parseInt(params.orderId as string);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payments | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [oRes, pRes] = await Promise.all([
          fetch(`/api/business/${bizId}/orders/${orderId}`),
          fetch(`/api/business/${bizId}/orders/${orderId}/payments`),
        ]);
        const oData = await oRes.json();
        if (oData.success) setOrder(oData.order);
        else setError(oData.message);
        const pData = await pRes.json();
        if (pData.success) setPayments(pData);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId, orderId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!order) return <div className="max-w-3xl mx-auto p-6"><div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "الطلب غير موجود"}</div></div>;

  const invoiceDate = new Date(order.createdAt);
  const paid = payments?.summary.totalPaid ?? 0;
  const remaining = payments?.summary.remaining ?? Number(order.total);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .invoice-page {
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            padding: 10mm !important;
            box-shadow: none !important;
          }
          @page { margin: 1cm; size: A4; }
        }
      `}</style>

      <div className="no-print max-w-3xl mx-auto p-6 flex justify-between items-center">
        <Link href={`/business/${bizId}/orders/${orderId}?side=buyer`} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> عودة للطلب
        </Link>
        <button onClick={() => window.print()} className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600 flex items-center gap-2">
          <Printer className="h-4 w-4" /> طباعة / PDF
        </button>
      </div>

      <div className="invoice-page max-w-3xl mx-auto p-8 bg-white border rounded-xl my-6 shadow-sm">
        <div className="flex justify-between items-start pb-6 border-b-2 border-gray-200">
          <div>
            <h1 className="text-3xl font-bold mb-2">فاتورة</h1>
            <p className="text-sm text-gray-600">رقم الفاتورة: <span className="font-mono font-semibold text-gray-900">{order.orderNumber}</span></p>
            <p className="text-sm text-gray-600">التاريخ: {invoiceDate.toLocaleDateString("ar-MA")}</p>
          </div>
          <div className="text-left text-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">الحالة</p>
            <p className="font-semibold">{STATUS_LABEL[order.status] || order.status}</p>
            {order.deliveredAt && <p className="text-xs text-gray-500 mt-2">سُلّم: {new Date(order.deliveredAt).toLocaleDateString("ar-MA")}</p>}
            {order.trackingNumber && (
              <p className="text-xs text-gray-500 mt-1">تتبع: <span className="font-mono">{order.trackingNumber}</span></p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 border-b">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2 tracking-wide">البائع</p>
            <p className="font-semibold text-lg">{order.sellerBusiness.name}</p>
            <p className="text-sm text-gray-600">{order.sellerBusiness.city}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase mb-2 tracking-wide">المشتري</p>
            <p className="font-semibold text-lg">{order.buyerBusiness.name}</p>
            <p className="text-sm text-gray-600">{order.buyerBusiness.city}</p>
          </div>
        </div>

        <div className="py-6 border-b">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-right py-2 font-semibold">المنتج</th>
                <th className="text-center py-2 font-semibold">الكمية</th>
                <th className="text-left py-2 font-semibold">سعر الوحدة</th>
                <th className="text-left py-2 font-semibold">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-medium">{it.productName}</p>
                    {it.masterVariant.options && (
                      <p className="text-xs text-gray-500">{Object.entries(it.masterVariant.options).map(([k, v]) => `${k}: ${v}`).join(" / ")}</p>
                    )}
                  </td>
                  <td className="text-center">{it.quantity}</td>
                  <td className="text-left">{Number(it.unitPrice).toFixed(2)}</td>
                  <td className="text-left font-semibold">{Number(it.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="py-4 border-b">
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">المجموع الفرعي:</span> <span>{Number(order.subtotal).toFixed(2)} د.م</span></div>
            {Number(order.shippingCost) > 0 && <div className="flex justify-between"><span className="text-gray-600">الشحن:</span> <span>{Number(order.shippingCost).toFixed(2)} د.م</span></div>}
            {Number(order.discountAmount) > 0 && <div className="flex justify-between text-green-600"><span>خصم:</span> <span>-{Number(order.discountAmount).toFixed(2)} د.م</span></div>}
            <div className="flex justify-between border-t pt-2 mt-2 font-bold text-base"><span>الإجمالي:</span> <span className="text-orange-600">{Number(order.total).toFixed(2)} د.م</span></div>
            <div className="flex justify-between text-green-700"><span>مدفوع:</span> <span>{paid.toFixed(2)} د.م</span></div>
            <div className={`flex justify-between font-semibold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}>
              <span>المتبقي:</span> <span>{remaining.toFixed(2)} د.م</span>
            </div>
          </div>
        </div>

        {payments && payments.payments.length > 0 && (
          <div className="py-4 border-b">
            <p className="text-xs text-gray-500 uppercase mb-2 tracking-wide">سجل الدفعات</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-right py-1 text-xs font-medium text-gray-500">التاريخ</th>
                  <th className="text-right py-1 text-xs font-medium text-gray-500">بواسطة</th>
                  <th className="text-left py-1 text-xs font-medium text-gray-500">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {payments.payments.filter(p => p.status === "CONFIRMED").map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 text-xs">{new Date(p.createdAt).toLocaleDateString("ar-MA")}</td>
                    <td className="py-1.5 text-xs">{p.createdBy.name}</td>
                    <td className="text-left py-1.5 font-medium">{Number(p.amount).toFixed(2)} د.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {order.notes && (
          <div className="py-4 border-b">
            <p className="text-xs text-gray-500 uppercase mb-1 tracking-wide">ملاحظات</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        <div className="pt-4 text-xs text-gray-500 text-center">
          <p>هذه الفاتورة صادرة إلكترونياً من منصة السوق</p>
          <p className="mt-1">الرقم المرجعي: <span className="font-mono">{order.orderNumber}</span></p>
        </div>
      </div>
    </>
  );
}