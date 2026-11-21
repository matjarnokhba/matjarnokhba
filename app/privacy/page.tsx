import { Shield, Lock, Eye, Server, UserCheck, Mail } from "lucide-react";

export const metadata = {
  title: "سياسة الخصوصية | متجر نخبة",
  description: "كيف نجمع بياناتك ونحميها ونستخدمها في متجر نخبة",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-[#ff5c00]" />
          <h1 className="text-3xl font-black text-gray-900">سياسة الخصوصية</h1>
        </div>

        <p className="text-sm text-gray-500">
          آخر تحديث: {new Date().toLocaleDateString("ar-MA")}
        </p>

        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Eye className="h-5 w-5 text-[#ff5c00]" />
              المعلومات التي نجمعها
            </h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li><strong>معلومات الحساب:</strong> الاسم، البريد الإلكتروني، رقم الهاتف، تاريخ التسجيل.</li>
              <li><strong>معلومات الشحن:</strong> العنوان الكامل (المدينة، الحي، الشارع)، إحداثيات جغرافية اختيارية.</li>
              <li><strong>معلومات الطلبات:</strong> المنتجات المشتراة، الأسعار، حالات الطلب، سجل الدفع.</li>
              <li><strong>بيانات تقنية:</strong> عنوان IP، نوع المتصفح، الجهاز، سجلات الجلسة.</li>
              <li><strong>ملفات تعريف الارتباط:</strong> جلسات مشفرة، تفضيلات الموقع (السلة، اللغة).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Lock className="h-5 w-5 text-[#ff5c00]" />
              كيف نحمي بياناتك
            </h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>تشفير كلمات المرور باستخدام bcrypt (لا نخزّن النص الأصلي).</li>
              <li>تشفير بيانات البنوك والوثائق الحساسة بـ AES-256-GCM.</li>
              <li>اتصالات HTTPS فقط بين المتصفح والخادم.</li>
              <li>جلسات مشفرة بكوكيز httpOnly + Secure + SameSite.</li>
              <li>وصول محدود لقاعدة البيانات (أدمن فقط + سجلات تدقيق).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Server className="h-5 w-5 text-[#ff5c00]" />
              كيف نستخدم المعلومات
            </h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>تنفيذ طلباتك (شحن، دفع، تواصل مع البائع).</li>
              <li>إرسال تحديثات الطلب وإشعارات الحساب.</li>
              <li>تحسين الموقع واكتشاف الأخطاء (logs تقنية).</li>
              <li>مكافحة الاحتيال وإساءة الاستخدام (rate limiting، تحقق بريد).</li>
              <li>الامتثال للالتزامات القانونية.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <UserCheck className="h-5 w-5 text-[#ff5c00]" />
              حقوقك
            </h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>الاطلاع على بياناتك المحفوظة وطلب نسخة منها.</li>
              <li>تصحيح بياناتك أو تحديثها.</li>
              <li>طلب حذف حسابك (يُعالج خلال 30 يومًا، مع الاحتفاظ بما يفرضه القانون).</li>
              <li>إلغاء الاشتراك في الإشعارات الترويجية (الإشعارات الضرورية تُبقى).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Mail className="h-5 w-5 text-[#ff5c00]" />
              التواصل
            </h2>
            <p className="text-sm text-gray-700">
              لأي سؤال حول خصوصيتك، تواصل معنا:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-700">
              <li>البريد: <span dir="ltr">contact@matjarnokhba.ma</span></li>
              <li>الهاتف: <span dir="ltr">+212 6 00 00 00 00</span></li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">مشاركة البيانات مع أطراف ثالثة</h2>
            <p className="text-sm text-gray-700">
              نشارك الحد الأدنى من البيانات مع: البائع (لتنفيذ طلبك)، السائق (للشحن)،
              مزود الاستضافة (Vercel)، مزود قاعدة البيانات (Neon)، مزود البريد (SMTP).
              لا نبيع بياناتك لأي طرف ثالث.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">ملفات تعريف الارتباط (Cookies)</h2>
            <p className="text-sm text-gray-700">
              نستخدم كوكيز ضرورية فقط: جلسة تسجيل الدخول (httpOnly)، تفضيلات السلة.
              لا نستخدم كوكيز تتبع إعلاني حاليًا.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">التعديلات على السياسة</h2>
            <p className="text-sm text-gray-700">
              قد نحدّث هذه السياسة. سننشر التغييرات هنا مع تاريخ التحديث.
              استمرارك في استخدام الموقع بعد النشر يعني موافقتك.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}