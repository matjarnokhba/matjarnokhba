import { MessageCircle, Phone, Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-black">التواصل معنا</h1>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-[#ff5c00]" />
              <div>
                <div className="text-sm font-bold">الهاتف</div>
                <div className="text-xs text-gray-500" dir="ltr">
                  +212 5XX XX XX XX
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-[#ff5c00]" />
              <div>
                <div className="text-sm font-bold">البريد الإلكتروني</div>
                <div className="text-xs text-gray-500">
                  support@matjarnokhba.ma
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-[#ff5c00]" />
              <div>
                <div className="text-sm font-bold">واتساب</div>
                <div className="text-xs text-gray-500" dir="ltr">
                  +212 6XX XX XX XX
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}