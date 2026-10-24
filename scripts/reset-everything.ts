import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚨 بدء تصفير النظام الشامل (شامل المحافظ والنظام المالي)...");

  // 1. الجداول المالية (الأحدث أولاً)
  await prisma.walletTransactionUnified.deleteMany({});
  await prisma.walletTransaction.deleteMany({});
  await prisma.customerWalletTransaction.deleteMany({});
  await prisma.withdrawalRequest.deleteMany({});
  await prisma.cashHandover.deleteMany({});
  await prisma.adminCashHandover.deleteMany({});
  await prisma.driverPayout.deleteMany({});
  await prisma.driverLegalNotice.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.costRecord.deleteMany({});
  await prisma.sellerPayout.deleteMany({});
  await prisma.subscriptionLog.deleteMany({});
  
  // 2. المرتجعات
  await prisma.returnItem.deleteMany({});
  await prisma.returnShipment.deleteMany({});
  await prisma.returnRequest.deleteMany({});

  // 3. استلامات المستودع (قبل FulfillmentItem)
  await prisma.warehouseReceipt.deleteMany({});

  // 4. مبيعات المحل (POS)
  await prisma.storeSaleItem.deleteMany({});
  await prisma.storeSale.deleteMany({});
  
  // 5. التجميع
  await prisma.assemblyItem.deleteMany({});
  await prisma.assemblyFile.deleteMany({});

  // 6. دفعات الجمع
  await prisma.collectionAssignmentItem.deleteMany({});
  await prisma.collectionAssignment.deleteMany({});
  await prisma.collectionBatchItem.deleteMany({});
  await prisma.collectionBatch.deleteMany({});

  // 7. الشحنات
  await prisma.shipmentItem.deleteMany({});
  await prisma.shipmentGroupingDecision.deleteMany({});
  await prisma.deliveryAssignment.deleteMany({});
  await prisma.deliveryAttempt.deleteMany({});
  await prisma.shipment.deleteMany({});

  // 8. التجهيزات
  await prisma.fulfillmentStatusHistory.deleteMany({});
  await prisma.fulfillmentItem.deleteMany({});
  
  // 9. الطلبات
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  
  // 10. المتنوعات
  await prisma.couponUsage.deleteMany({});
  await prisma.loyaltyTransaction.deleteMany({});
  await prisma.loyaltyTierUnlock.deleteMany({});
  await prisma.loyaltyReward.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.productEditLog.deleteMany({});
  await prisma.sellerPerformanceSnapshot.deleteMany({});
  await prisma.idempotencyKey.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});

  console.log("✅ تم مسح جميع الطلبات، الشحنات، السجلات المالية، والمحافظ.");

  // 11. تصفير العدادات والأرصدة
  await prisma.seller.updateMany({
    data: {
      walletBalance: 0,
      heldBalance: 0,
      totalOrders: 0,
      totalRevenue: 0,
      totalCommission: 0,
      acceptanceRate: 0,
      cancellationRate: 0,
      codRejectionRate: 0,
      returnRate: 0,
      avgRating: 0,
      avgProcessingHours: 0,
      subscriptionStatus: "TRIAL",
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
  });
  
  await prisma.deliveryPerson.updateMany({
    data: {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      returnCount: 0,
    }
  });

  await prisma.product.updateMany({
    data: { sold: 0, rating: 0, reviewsCount: 0 }
  });

  await prisma.inventory.updateMany({
    data: { reservedQuantity: 0 }
  });

  await prisma.coupon.updateMany({
    data: { usedCount: 0 }
  });

  await prisma.loyaltyAccount.updateMany({
    data: { balance: 0, totalEarned: 0, totalRevoked: 0 }
  });

  console.log("🎉 اكتملت عملية التصفير الشاملة بنجاح! النظام الآن نظيف تماماً.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });