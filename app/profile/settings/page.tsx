import Link from "next/link";
import { ArrowRight, Settings } from "lucide-react";

export default function ProfileSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/profile"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع
      </Link>

      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <Settings className="mx-auto h-12 w-12 text-gray-300" />
        <h1 className="mt-3 text-lg font-black">الإعدادات</h1>
        <p className="mt-2 text-sm text-gray-500">
          قريبًا: إدارة الإشعارات، اللغة، الخصوصية
        </p>
      </div>
    </div>
  );
}