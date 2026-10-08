import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ productCode: string }>;
};

export default async function ProductByCodePage({ params }: Props) {
  const { productCode } = await params;

  const product = await prisma.product.findFirst({
    where: {
      productCode,
      status: "ACTIVE",
      deletedAt: null,
      seller: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
    select: {
      slug: true,
      seller: {
        select: { slug: true },
      },
    },
  });

  if (!product || !product.seller) {
    notFound();
  }

  // ═══ إعادة التوجيه لصفحة المنتج العادية ═══
  redirect(`/product/${product.seller.slug}/${product.slug}`);
}