import type { Product } from "@/lib/data/products";
import ProductCard from "./ProductCard";

type ProductGridProps = {
  products: Product[];
  onAddToCart: (product: Product) => void;
  columns?: "compact" | "wide";
};

export default function ProductGrid({
  products,
  onAddToCart,
  columns = "compact",
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className="text-5xl">🔍</div>
        <h3 className="mt-4 text-lg font-bold text-[#4b5563]">
          لم نجد منتجات مطابقة
        </h3>
        <p className="mt-2 text-sm text-[#6b7280]">
          جر​ب تغيير كلمة البحث أو التصنيف.
        </p>
      </div>
    );
  }

  // الهاتف: gap صغير جداً (شعرة) + عمودان
  // سطح المكتب: gap عادي + أعمدة أكثر
  const gridClass =
    columns === "compact"
      ? "grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5"
      : "grid grid-cols-2 gap-1 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={gridClass}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </div>
  );
}