import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔧 إصلاح ملفات التجميع الناقصة...\n");

  // ═══ 1. البحث عن طلبات VERIFIED بدون AssemblyItem ═══
  const verifiedItems = await prisma.fulfillmentItem.findMany({
    where: {
      status: {
        in: ["VERIFIED", "RECEIVED", "AVAILABLE_FOR_SHIPMENT"],
      },
    },
    include: {
      orderItem: {
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              userId: true,
              status: true,
            },
          },
        },
      },
    },
  });

  console.log(`📊 إجمالي العناصر المؤهلة: ${verifiedItems.length}`);

  // ═══ 2. تجميع حسب المستخدم ═══
  const userMap = new Map<number, number[]>(); // userId → fulfillmentItemIds
  for (const fi of verifiedItems) {
    const userId = fi.orderItem.order.userId;
    if (!userMap.has(userId)) userMap.set(userId, []);
    userMap.get(userId)!.push(fi.id);
  }

  console.log(`👥 عدد المستخدمين المتأثرين: ${userMap.size}\n`);

  // ═══ 3. إصلاح كل مستخدم ═══
  for (const [userId, fiIds] of userMap) {
    console.log(`\n👤 إصلاح المستخدم #${userId} (${fiIds.length} عنصر)`);

    // البحث عن AssemblyFile موجود
    let assembly = await prisma.assemblyFile.findUnique({
      where: { userId },
    });

    if (!assembly) {
      // إنشاء جديد
      const year = new Date().getFullYear();
      const count = await prisma.assemblyFile.count({
        where: { assemblyCode: { startsWith: `ASM-${year}-` } },
      });
      const assemblyCode = `ASM-${year}-${String(count + 1).padStart(5, "0")}`;

      const allItems = await prisma.fulfillmentItem.findMany({
        where: {
          orderItem: {
            order: { userId, status: { notIn: ["CANCELLED"] } },
          },
        },
        select: {
          id: true,
          quantity: true,
          orderItem: {
            select: {
              order: { select: { shippingAddressSnapshot: true } },
            },
          },
        },
      });

      const addr = (allItems[0]?.orderItem?.order?.shippingAddressSnapshot ||
        {}) as any;
      const expectedItems = allItems.reduce((s, fi) => s + fi.quantity, 0);

      assembly = await prisma.assemblyFile.create({
        data: {
          assemblyCode,
          userId,
          status: "PENDING",
          expectedItems,
          deliveryCity: addr.city || null,
          deliveryDistrict: addr.district || null,
        },
      });

      for (const fi of allItems) {
        await prisma.assemblyItem.create({
          data: {
            assemblyId: assembly.id,
            fulfillmentItemId: fi.id,
            expectedQuantity: fi.quantity,
          },
        });
      }

      console.log(`  ✅ تم إنشاء AssemblyFile #${assembly.id} (${assemblyCode})`);
    } else {
      // ملف موجود → نُضيف العناصر المفقودة
      const existingItems = await prisma.assemblyItem.findMany({
        where: { assemblyId: assembly.id },
        select: { fulfillmentItemId: true },
      });
      const existingIds = new Set(
        existingItems.map((i) => i.fulfillmentItemId)
      );
      const missing = fiIds.filter((id) => !existingIds.has(id));

      for (const fiId of missing) {
        const fi = await prisma.fulfillmentItem.findUnique({
          where: { id: fiId },
          select: { quantity: true },
        });
        if (!fi) continue;

        await prisma.assemblyItem.create({
          data: {
            assemblyId: assembly.id,
            fulfillmentItemId: fiId,
            expectedQuantity: fi.quantity,
          },
        });
      }

      console.log(
        `  ✅ AssemblyFile #${assembly.id} موجود — أُضيف ${missing.length} عنصر`
      );
    }

    // إعادة الحساب
    const items = await prisma.assemblyItem.findMany({
      where: { assemblyId: assembly.id },
      include: {
        fulfillmentItem: { select: { status: true } },
      },
    });

    const RECEIVED = [
      "RECEIVED",
      "VERIFIED",
      "AVAILABLE_FOR_SHIPMENT",
      "ALLOCATED",
      "SHIPPED",
      "DELIVERED",
    ];
    const SHIPPED = ["ALLOCATED", "SHIPPED", "DELIVERED"];

    let expected = 0;
    let received = 0;
    let shipped = 0;

    for (const item of items) {
      expected += item.expectedQuantity;
      if (RECEIVED.includes(item.fulfillmentItem.status))
        received += item.expectedQuantity;
      if (
        SHIPPED.includes(item.fulfillmentItem.status) ||
        item.includedInShipment
      )
        shipped += item.expectedQuantity;
    }

    const allReceived = expected > 0 && received >= expected;
    const allShipped = expected > 0 && shipped >= expected;

    let status: "COMPLETED" | "READY" | "PARTIALLY_SHIPPED" | "PENDING";
    if (allShipped) status = "COMPLETED";
    else if (allReceived) status = "READY";
    else if (shipped > 0) status = "PARTIALLY_SHIPPED";
    else status = "PENDING";

    await prisma.assemblyFile.update({
      where: { id: assembly.id },
      data: {
        expectedItems: expected,
        receivedItems: received,
        shippedItems: shipped,
        status,
      },
    });

    console.log(
      `  📊 الحالة: ${status} (expected: ${expected}, received: ${received}, shipped: ${shipped})`
    );
  }

  console.log("\n🎉 اكتمل الإصلاح!");
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());