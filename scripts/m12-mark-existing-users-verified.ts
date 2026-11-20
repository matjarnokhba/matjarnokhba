import "dotenv/config";
import { prisma } from "../lib/prisma";

// ═══════════════════════════════════════════════════════════════
// M12 — Mark existing users as email-verified (one-time migration)
//
// السبب: نظام التحقق من البريد أُضيف بعد بدء المنصة. المستخدمون
// القدامى لم يستلموا بريد تحقق وemailVerified=false. بعد تفعيل
// إلزام التحقق في login، سيُحجبون. هذا السكربت يرقّيهم بحسب
// تاريخ محدد، مع استثناء:
//   - googleId != null (موثقون أصلًا عبر Google)
//   - deletedAt != null (محذوفون)
//   - createdAt >= --before (مسجلون بعد بدء النظام الجديد)
//
// يُشغّل فقط بـ: --confirm-migrate --before=YYYY-MM-DD
// ═══════════════════════════════════════════════════════════════

if (process.env.NODE_ENV === "production") {
  console.error("🚫 مرفوض: لا يعمل في production مباشرة.");
  console.error("   للترحيل على production، اضبط NODE_ENV يدويًا بعد مراجعة كاملة.");
  process.exit(1);
}

const confirmArg = process.argv.find((a) => a === "--confirm-migrate");
const beforeArg = process.argv.find((a) => a.startsWith("--before="));

if (!confirmArg) {
  console.error("🚫 مرفوض: استخدم --confirm-migrate لتأكيد الترحيل.");
  console.error("   مثال: npx tsx --env-file=.env scripts/m12-mark-existing-users-verified.ts --confirm-migrate --before=2026-11-20");
  process.exit(1);
}

if (!beforeArg) {
  console.error("🚫 مرفوض: استخدم --before=YYYY-MM-DD لتحديد التاريخ الحدّي.");
  console.error("   المستخدمون المسجلون قبل هذا التاريخ سيُرقّون إلى emailVerified=true.");
  process.exit(1);
}

const beforeDateStr = beforeArg.split("=")[1];
const beforeDate = new Date(beforeDateStr + "T00:00:00.000Z");
if (isNaN(beforeDate.getTime())) {
  console.error(`🚫 تاريخ غير صالح: ${beforeDateStr}`);
  process.exit(1);
}

async function main() {
  const dbHost = (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] ?? "unknown";
  console.log(`⚠️  سيتم الترحيل على: ${dbHost}`);
  console.log(`   التاريخ الحدّي: ${beforeDate.toISOString()}`);
  console.log(`   (كل من سجّل قبل هذا التاريخ سيُرقّى)`);

  const candidates = await prisma.user.count({
    where: {
      emailVerified: false,
      googleId: null,
      deletedAt: null,
      createdAt: { lt: beforeDate },
    },
  });

  const skippedGoogle = await prisma.user.count({
    where: { emailVerified: false, googleId: { not: null }, deletedAt: null },
  });
  const skippedDeleted = await prisma.user.count({
    where: { emailVerified: false, deletedAt: { not: null } },
  });
  const skippedNew = await prisma.user.count({
    where: { emailVerified: false, googleId: null, deletedAt: null, createdAt: { gte: beforeDate } },
  });

  console.log("");
  console.log(`📊 إحصاء:`);
  console.log(`   - سيُرقّى:      ${candidates}`);
  console.log(`   - مستثنى (Google): ${skippedGoogle}`);
  console.log(`   - مستثنى (محذوف): ${skippedDeleted}`);
  console.log(`   - مستثنى (جديد):  ${skippedNew}`);
  console.log("");

  if (candidates === 0) {
    console.log("✅ لا شيء لفعله. لا مرشحين للترقية.");
    return;
  }

  console.log("⏳ سيبدأ التحديث خلال 10 ثوانٍ — للتراجع: Ctrl+C");
  await new Promise((r) => setTimeout(r, 10000));

  const result = await prisma.user.updateMany({
    where: {
      emailVerified: false,
      googleId: null,
      deletedAt: null,
      createdAt: { lt: beforeDate },
    },
    data: { emailVerified: true },
  });

  console.log(`✅ تم ترقية ${result.count} مستخدم إلى emailVerified=true.`);

  await prisma.auditLog.create({
    data: {
      action: "UPDATE",
      entity: "User",
      entityId: "bulk-migration",
      newData: {
        operation: "M12_MARK_EXISTING_VERIFIED",
        affectedCount: result.count,
        beforeDate: beforeDate.toISOString(),
        dbHost,
      },
    },
  });

  console.log("✅ سُجّل الترحيل في AuditLog.");
}

main()
  .catch((e) => {
    console.error("💥 خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());