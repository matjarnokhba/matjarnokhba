import { HelpCircle } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm">
        <HelpCircle className="mx-auto h-12 w-12 text-gray-300" />
        <h1 className="mt-3 text-2xl font-black">مركز المساعدة</h1>
        <p className="mt-2 text-sm text-gray-500">
          قريبًا: أسئلة شائعة، فيديوهات تعليمية، دليل الاستخدام
        </p>
      </div>
    </div>
  );
}