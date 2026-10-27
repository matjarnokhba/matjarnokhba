import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const leaves = await prisma.category.findMany({
    where: { parentId: { not: null }, deletedAt: null },
    select: { id: true, slug: true, parentId: true, parent: { select: { slug: true } } },
    orderBy: { slug: "asc" },
  });

  console.log(`Processing ${leaves.length} leaf categories...\n`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let leavesWithAttrs = 0;

  for (const leaf of leaves) {
    if (!leaf.parentId) continue;

    const parentAttrs = await prisma.categoryAttribute.findMany({
      where: { categoryId: leaf.parentId },
      include: { values: { orderBy: { order: "asc" } } },
    });

    if (parentAttrs.length === 0) continue;
    leavesWithAttrs++;

    let created = 0;
    let skipped = 0;

    for (const pa of parentAttrs) {
      const exists = await prisma.categoryAttribute.findUnique({
        where: { categoryId_slug: { categoryId: leaf.id, slug: pa.slug } },
        select: { id: true },
      });
      if (exists) { skipped++; continue; }

      await prisma.categoryAttribute.create({
        data: {
          categoryId: leaf.id,
          name: pa.name,
          slug: pa.slug,
          type: pa.type,
          isVariantAxis: pa.isVariantAxis,
          isRequired: pa.isRequired,
          allowCustom: pa.allowCustom,
          order: pa.order,
          isActive: true,
          values: {
            create: pa.values.map(v => ({
              value: v.value,
              slug: v.slug,
              colorHex: v.colorHex,
              order: v.order,
              isActive: true,
            })),
          },
        },
      });
      created++;
    }

    console.log(`  ${leaf.parent?.slug} -> ${leaf.slug}: +${created} created, ${skipped} skipped`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Total attributes created: ${totalCreated}`);
  console.log(`✅ Total skipped: ${totalSkipped}`);
  console.log(`✅ Leaves with attributes: ${leavesWithAttrs}/${leaves.length}`);
  console.log(`════════════════════════════════════════`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("ERROR:", e); process.exit(1); });
