import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

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