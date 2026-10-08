import "dotenv/config";
import { PermissionService } from "@/services/permission.service";

async function main() {
  console.log("🔐 مزامنة الصلاحيات...\n");

  const created = await PermissionService.syncDefaults();

  console.log(`✅ تم إنشاء ${created} صلاحية جديدة`);

  // قائمة الصلاحيات الموجودة
  const { prisma } = await import("@/lib/prisma");
  const all = await prisma.permission.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  console.log(`\n📋 إجمالي الصلاحيات: ${all.length}\n`);
  for (const p of all) {
    console.log(`  [${p.category}] ${p.key} — ${p.name}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});