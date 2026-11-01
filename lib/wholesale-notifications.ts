import { prisma } from "@/lib/prisma";

async function notify(userId: number, data: { title: string; message: string; link: string; type?: string }) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: (data.type ?? "WHOLESALE_EVENT") as any,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
  } catch (e: any) {
    console.error(`Notification failed for user ${userId}:`, e.message);
  }
}

export const WholesaleNotifications = {
  async orderPlaced(sellerUserId: number, p: { orderId: number; orderNumber: string; buyerName: string; total: number }) {
    await notify(sellerUserId, { title: "📦 طلب جملة جديد", message: `${p.buyerName} قدّم طلبًا بقيمة ${p.total.toFixed(2)} د.م. رقم الطلب: ${p.orderNumber}`, link: `/business/orders?highlight=${p.orderId}`, type: "WHOLESALE_ORDER_PLACED" });
  },
  async orderAccepted(buyerUserId: number, p: { orderId: number; orderNumber: string; sellerName: string }) {
    await notify(buyerUserId, { title: "✅ تم قبول طلبك", message: `قبل "${p.sellerName}" طلبك ${p.orderNumber}.`, link: `/business/orders/${p.orderId}`, type: "WHOLESALE_ORDER_ACCEPTED" });
  },
  async orderRejected(buyerUserId: number, p: { orderId: number; orderNumber: string; sellerName: string; reason?: string | null }) {
    await notify(buyerUserId, { title: "❌ تم رفض طلبك", message: `رفض "${p.sellerName}" طلبك ${p.orderNumber}.${p.reason ? ` السبب: ${p.reason}` : ""}`, link: `/business/orders/${p.orderId}`, type: "WHOLESALE_ORDER_REJECTED" });
  },
  async orderShipped(buyerUserId: number, p: { orderId: number; orderNumber: string; trackingNumber?: string | null; carrier?: string | null }) {
    await notify(buyerUserId, { title: "🚚 تم شحن طلبك", message: `طلبك ${p.orderNumber} في الطريق.${p.carrier ? ` الناقل: ${p.carrier}.` : ""}`, link: `/business/orders/${p.orderId}`, type: "WHOLESALE_ORDER_SHIPPED" });
  },
  async orderDelivered(sellerUserId: number, p: { orderId: number; orderNumber: string; buyerName: string }) {
    await notify(sellerUserId, { title: "✅ تم تسليم طلبك", message: `أكد "${p.buyerName}" استلام الطلب ${p.orderNumber}.`, link: `/business/orders/${p.orderId}`, type: "WHOLESALE_ORDER_DELIVERED" });
  },
  async paymentReceived(sellerUserId: number, p: { orderId: number; orderNumber: string; amount: number; buyerName: string }) {
    await notify(sellerUserId, { title: "💰 دفعة مستلمة", message: `استلمت ${p.amount.toFixed(2)} د.م من "${p.buyerName}" على الطلب ${p.orderNumber}.`, link: `/business/orders/${p.orderId}`, type: "WHOLESALE_PAYMENT_RECEIVED" });
  },
  async returnRequested(sellerUserId: number, p: { returnId: number; returnNumber: string; orderNumber: string; amount: number }) {
    await notify(sellerUserId, { title: "↩️ طلب مرتجع جديد", message: `مرتجع على الطلب ${p.orderNumber} بقيمة ${p.amount.toFixed(2)} د.م.`, link: `/business/returns/${p.returnId}`, type: "WHOLESALE_RETURN_REQUESTED" });
  },
  async returnApproved(buyerUserId: number, p: { returnId: number; returnNumber: string }) {
    await notify(buyerUserId, { title: "✅ تم قبول المرتجع", message: `تم قبول مرتجعك ${p.returnNumber}.`, link: `/business/returns/${p.returnId}`, type: "WHOLESALE_RETURN_APPROVED" });
  },
  async returnRejected(buyerUserId: number, p: { returnId: number; returnNumber: string; reason?: string | null }) {
    await notify(buyerUserId, { title: "❌ تم رفض المرتجع", message: `تم رفض مرتجعك ${p.returnNumber}.${p.reason ? ` السبب: ${p.reason}` : ""}`, link: `/business/returns/${p.returnId}`, type: "WHOLESALE_RETURN_REJECTED" });
  },
  async returnRefunded(buyerUserId: number, p: { returnId: number; returnNumber: string; amount: number }) {
    await notify(buyerUserId, { title: "💵 تم استرداد المبلغ", message: `تم استرداد ${p.amount.toFixed(2)} د.م لمرتجعك ${p.returnNumber}.`, link: `/business/returns/${p.returnId}`, type: "WHOLESALE_RETURN_REFUNDED" });
  },
  async businessVerified(ownerUserId: number, p: { businessId: number; businessName: string }) {
    await notify(ownerUserId, { title: "🎉 تم توثيق نشاطك", message: `تمت الموافقة على "${p.businessName}".`, link: `/business/${p.businessId}`, type: "WHOLESALE_BUSINESS_VERIFIED" });
  },
  async businessRejected(ownerUserId: number, p: { businessId: number; businessName: string; reason?: string | null }) {
    await notify(ownerUserId, { title: "❌ تم رفض نشاطك", message: `تم رفض "${p.businessName}".${p.reason ? ` السبب: ${p.reason}` : ""}`, link: `/business/${p.businessId}`, type: "WHOLESALE_BUSINESS_REJECTED" });
  },
  async supplyActivityVerified(ownerUserId: number, p: { businessId: number; saName: string }) {
    await notify(ownerUserId, { title: "✅ تم توثيق هوية", message: `تمت الموافقة على هويتك "${p.saName}".`, link: `/business/${p.businessId}/supply-activities`, type: "WHOLESALE_SA_VERIFIED" });
  },
  async supplyActivityRejected(ownerUserId: number, p: { businessId: number; saName: string; reason?: string | null }) {
    await notify(ownerUserId, { title: "❌ تم رفض هوية", message: `تم رفض هويتك "${p.saName}".${p.reason ? ` السبب: ${p.reason}` : ""}`, link: `/business/${p.businessId}/supply-activities`, type: "WHOLESALE_SA_REJECTED" });
  },
  async offerVerified(ownerUserId: number, p: { offerId: number; masterName: string }) {
    await notify(ownerUserId, { title: "✅ تم توثيق عرضك", message: `تمت الموافقة على عرض "${p.masterName}".`, link: `/business/offers/${p.offerId}`, type: "WHOLESALE_OFFER_VERIFIED" });
  },
  async offerRejected(ownerUserId: number, p: { offerId: number; masterName: string; reason?: string | null }) {
    await notify(ownerUserId, { title: "❌ تم رفض عرضك", message: `تم رفض عرض "${p.masterName}".${p.reason ? ` السبب: ${p.reason}` : ""}`, link: `/business/offers/${p.offerId}`, type: "WHOLESALE_OFFER_REJECTED" });
  },
};