import "dotenv/config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

const BASE_URL = "http://localhost:3000";
const prefix = `SMOKE-${Date.now()}`;

type PageTest = {
  path: string;
  role: string;
  expectedElements: string[];
};

const PAGES: PageTest[] = [
  {
    path: "/",
    role: "guest",
    expectedElements: ["nav", "footer"],
  },
  {
    path: "/login",
    role: "guest",
    expectedElements: ["form", "input", "button"],
  },
  {
    path: "/register",
    role: "guest",
    expectedElements: ["form", "input", "button"],
  },
  {
    path: "/checkout",
    role: "guest",
    expectedElements: ["main"],
  },
  {
    path: "/admin",
    role: "admin",
    expectedElements: ["aside", "table"],
  },
  {
    path: "/admin/orders",
    role: "admin",
    expectedElements: ["table"],
  },
  {
    path: "/admin/products",
    role: "admin",
    expectedElements: ["table"],
  },
  {
    path: "/admin/sellers",
    role: "admin",
    expectedElements: ["table"],
  },
  {
    path: "/admin/warehouse",
    role: "admin",
    expectedElements: ["table"],
  },
  {
    path: "/admin/shipments",
    role: "admin",
    expectedElements: ["table"],
  },
  {
    path: "/admin/legal-notices",
    role: "admin",
    expectedElements: ["main"],
  },
  {
    path: "/admin/returns-monitor",
    role: "admin",
    expectedElements: ["main"],
  },
  {
    path: "/admin/monitor",
    role: "admin",
    expectedElements: ["main"],
  },
  {
    path: "/admin/withdrawals",
    role: "admin",
    expectedElements: ["main"],
  },
  {
    path: "/seller",
    role: "seller",
    expectedElements: ["aside"],
  },
  {
    path: "/seller/products",
    role: "seller",
    expectedElements: ["main"],
  },
  {
    path: "/seller/orders",
    role: "seller",
    expectedElements: ["main"],
  },
  {
    path: "/seller/scanner",
    role: "seller",
    expectedElements: ["main"],
  },
  {
    path: "/seller/wallet",
    role: "seller",
    expectedElements: ["main"],
  },
  {
    path: "/seller/returns-batches",
    role: "seller",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse",
    role: "warehouse",
    expectedElements: ["aside"],
  },
  {
    path: "/warehouse/shipments",
    role: "warehouse",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse/returns-in-transit",
    role: "warehouse",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse/seller-returns",
    role: "warehouse",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse/cash-collection",
    role: "warehouse",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse/wallet",
    role: "warehouse",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse/driver-payouts",
    role: "warehouse",
    expectedElements: ["main"],
  },
  {
    path: "/warehouse/drivers-schedule",
    role: "warehouse",
    expectedElements: ["table"],
  },
  {
    path: "/delivery",
    role: "delivery",
    expectedElements: ["aside"],
  },
  {
    path: "/delivery/shipments",
    role: "delivery",
    expectedElements: ["main"],
  },
  {
    path: "/delivery/wallet",
    role: "delivery",
    expectedElements: ["main"],
  },
  {
    path: "/delivery/availability",
    role: "delivery",
    expectedElements: ["main"],
  },
  {
    path: "/delivery/scan",
    role: "delivery",
    expectedElements: ["main"],
  },
  {
    path: "/delivery/refused-handover",
    role: "delivery",
    expectedElements: ["main"],
  },
  {
    path: "/collector",
    role: "collector",
    expectedElements: ["aside"],
  },
  {
    path: "/collector/seller-returns",
    role: "collector",
    expectedElements: ["main"],
  },
  {
    path: "/collector/scan",
    role: "collector",
    expectedElements: ["main"],
  },
];

async function createSession(userId: number): Promise<string> {
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  return token;
}

async function main() {
  console.log("🧪 Smoke Test — فحص الصفحات\n");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`(تأكد أن السيرفر يعمل: npm run dev)\n`);

  const passwordHash = await bcrypt.hash("Test123!", 10);

  // ═══ Create test users ═══
  console.log("👥 إنشاء مستخدمين اختباريين...\n");

  const createdUsers: number[] = [];

  const makeUser = async (role: string, emailSuffix: string, name: string) => {
    const u = await prisma.user.create({
      data: {
        email: `${prefix}-${emailSuffix}@test.local`,
        passwordHash,
        name,
        phone: "0600000000",
        role: role as any,
        referralCode: `REF-${prefix}-${emailSuffix}`,
        deletedAt: null,
      },
    });
    createdUsers.push(u.id);
    return u;
  };

  const guestUser = await makeUser("CUSTOMER", "guest", "زبون");
  const adminUser = await makeUser("ADMIN", "admin", "أدمن");
  const sellerUser = await makeUser("SELLER", "seller", "تاجر");
  const warehouseUser = await makeUser("WAREHOUSE_MANAGER", "wh", "مستودع");
  const deliveryUser = await makeUser("DELIVERY", "dlv", "سائق");
  const collectorUser = await makeUser("COLLECTOR", "col", "جامع");

  // Seller record
  await prisma.seller.create({
    data: {
      userId: sellerUser.id,
      storeName: `متجر ${prefix}`,
      slug: `smoke-seller-${Date.now()}`,
      city: "الدار البيضاء",
      status: "ACTIVE",
    },
  });

  // Delivery person record
  await prisma.deliveryPerson.create({
    data: {
      userId: deliveryUser.id,
      city: "الدار البيضاء",
      phone: "0600000000",
      status: "ACTIVE",
    },
  });

  const sessions: Record<string, string> = {
    guest: await createSession(guestUser.id),
    admin: await createSession(adminUser.id),
    seller: await createSession(sellerUser.id),
    warehouse: await createSession(warehouseUser.id),
    delivery: await createSession(deliveryUser.id),
    collector: await createSession(collectorUser.id),
  };

  console.log("✅ جاهز\n");

  // ═══ Test each page ═══
  console.log("═".repeat(60) + "\n");

  let passed = 0;
  let failed = 0;
  const failures: { path: string; reason: string }[] = [];

  for (const page of PAGES) {
    const token = sessions[page.role];
    try {
      const res = await fetch(BASE_URL + page.path, {
        headers: {
          Cookie: `nokhba_session=${token}`,
          "User-Agent": "SmokeTest/1.0",
        },
        redirect: "manual",
      });

      const status = res.status;
      const html = await res.text();
      const htmlLength = html.length;

      // Checks
      const checks: string[] = [];

      if (status >= 500) {
        checks.push(`status=${status} (server error)`);
      } else if (status >= 400 && status !== 401 && status !== 403) {
        checks.push(`status=${status}`);
      }

      if (htmlLength < 100) {
        checks.push(`html too small (${htmlLength} chars)`);
      }

      // Missing expected elements
      for (const el of page.expectedElements) {
        if (!html.includes(`<${el}`)) {
          checks.push(`missing <${el}>`);
        }
      }

      // Any hard error text?
      if (html.includes("Application error") || html.includes("Internal Server Error")) {
        checks.push("Application error page");
      }

      // Suspense loading stuck?
      if (html.includes("جاري التحميل") && htmlLength < 500) {
        checks.push("stuck on loading");
      }

      if (checks.length === 0) {
        console.log(`✅ ${page.path.padEnd(40)} [${page.role}] ${status} · ${htmlLength}b`);
        passed++;
      } else {
        console.log(`❌ ${page.path.padEnd(40)} [${page.role}] → ${checks.join(" | ")}`);
        failures.push({ path: page.path, reason: checks.join(" | ") });
        failed++;
      }
    } catch (e: any) {
      console.log(`❌ ${page.path.padEnd(40)} [${page.role}] → ${e.message}`);
      failures.push({ path: page.path, reason: e.message });
      failed++;
    }
  }

  // ═══ Cleanup ═══
  console.log("\n🧹 Cleanup...\n");

  try {
    await prisma.session.deleteMany({ where: { userId: { in: createdUsers } } });
    await prisma.deliveryPerson.deleteMany({
      where: { userId: { in: createdUsers } },
    });
    const sellers = await prisma.seller.findMany({
      where: { userId: { in: createdUsers } },
    });
    for (const s of sellers) {
      await prisma.seller.delete({ where: { id: s.id } });
    }
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    console.log("✅ تم");
  } catch (e: any) {
    console.error(`⚠️ ${e.message}`);
  }

  // ═══ Report ═══
  console.log("\n" + "═".repeat(60));
  console.log(`📊 ${passed}/${PAGES.length} صفحة تعمل · ${failed} فاشلة`);
  console.log("═".repeat(60));

  if (failures.length > 0) {
    console.log("\n❌ الصفحات الفاشلة:");
    failures.forEach((f) => console.log(`   ${f.path} → ${f.reason}`));
    await prisma.$disconnect();
    process.exit(1);
  } else {
    console.log("\n🎉 كل الصفحات تعمل!");
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error("💥", e);
  await prisma.$disconnect();
  process.exit(1);
});