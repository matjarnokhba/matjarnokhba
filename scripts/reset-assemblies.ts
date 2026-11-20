import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// M12 — Guard rails
if (process.env.NODE_ENV === "production") {
  console.error("🚫 مرفوض: هذا السكربت لا يعمل في production.");
  process.exit(1);
}
if (!process.argv.includes("--confirm-wipe")) {
  console.error("🚫 مرفوض: استخدم --confirm-wipe لتأكيد التصفير.");
  console.error("   مثال: npx tsx --env-file=.env scripts/reset-assemblies.ts --confirm-wipe");
  process.exit(1);
}
const __dbHost = (process.env.DATABASE_URL || "").split("@")[1]?.split("/")[0] ?? "unknown";
console.log(`⚠️  سيتم تصفير التجميعات في: ${__dbHost}`);

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🗑️ Deleting all AssemblyItems...");
  const items = await prisma.assemblyItem.deleteMany({});
  console.log(`  Deleted ${items.count} items`);

  console.log("🗑️ Deleting all AssemblyFiles...");
  const files = await prisma.assemblyFile.deleteMany({});
  console.log(`  Deleted ${files.count} files`);

  console.log("✅ Done");
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));