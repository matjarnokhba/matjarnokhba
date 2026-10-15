import { FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <FileText className="h-6 w-6 text-[#ff5c00]" />
          الشروط والخصوصية
        </h1>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">
            قريبًا: الشروط والأحكام، سياسة الخصوصية، سياسة الإرجاع.
          </p>
        </div>
      </div>
    </div>
  );
}