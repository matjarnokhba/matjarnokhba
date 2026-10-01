import { permanentRedirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// ═══════════════════════════════════════════
// Redirect: /product/[slug] → /product/[sellerSlug]/[slug]
// 
// ملاحظة: slug أصبح فريداً لكل تاجر (وليس عالمياً).
// هذه الصفحة تتعامل مع الروابط القديمة فقط.
// ═══════════════════════════════════════════
export default async function ProductRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // ═══ البحث عن المنتج ═══
  // إذا كان هناك أكثر من منتج بنفس slug (من تجار مختلفين)
  // نختار الأكثر مبيعاً
  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      deletedAt: null,
      seller: {
        status: "ACTIVE",
        deletedAt: null,
      },
    },
    include: {
      seller: { select: { slug: true } },
    },
    orderBy: [{ sold: "desc" }, { createdAt: "desc" }],
  });

  // ═══ إذا لم يوجد → 404 ═══
  if (!product || !product.seller) {
    notFound();
  }

  // ═══ Redirect دائم (308) — يحفظ SEO ═══
  permanentRedirect(`/product/${product.seller.slug}/${product.slug}`);
}