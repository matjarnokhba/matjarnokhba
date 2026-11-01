import Link from "next/link";
import { Building2, Plus } from "lucide-react";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/business" className="flex items-center gap-2 font-bold text-xl">
            <Building2 className="h-6 w-6 text-orange-500" />
            أنشطتي التجارية
          </Link>
          <Link href="/business/new" className="rounded-lg bg-orange-500 px-4 py-2 text-white text-sm hover:bg-orange-600 flex items-center gap-1">
            <Plus className="h-4 w-4" />
            نشاط جديد
          </Link>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}