import { prisma } from "@/lib/prisma";
import NewProductForm from "@/components/admin/NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return <NewProductForm categories={categories} />;
}