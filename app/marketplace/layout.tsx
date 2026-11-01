import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/marketplace" className="flex items-center gap-2 font-bold text-xl">
            <ShoppingBag className="h-6 w-6 text-orange-500" />
            سوق الجملة
          </Link>
          <div className="flex gap-3 items-center">
            <Link href="/business" className="text-sm text-gray-600 hover:text-gray-900">نشاطاتي</Link>
            <Link href="/business/new" className="rounded-lg bg-orange-500 text-white px-3 py-1.5 text-sm hover:bg-orange-600">انضم كبائع</Link>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}