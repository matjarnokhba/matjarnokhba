import { FileText, Scale, RefreshCw, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "الشروط والأحكام | متجر نخبة",
  description: "شروط استخدام متجر نخبة، سياسة الإرجاع، والالتزامات",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-[#ff5c00]" />
          <h1 className="text-3xl font-black text-gray-900">الشروط والأحكام</h1>
        </div>

        <p className="text-sm text-gray-500">
          آخر تحديث: {new Date().toLocaleDateString("ar-MA")}
        </p>

        <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <Scale className="h-5 w-5 text-[#ff5c00]" />
              قبول الشروط
            </h2>
            <p className="text-sm text-gray-700">
              باستخدامك متجر نخبة، فإنك توافق على هذه الشروط. إذا لم توافق، يُرجى
              عدم استخدام الموقع.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">الحساب</h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>يجب أن تكون بعمر 18 عامًا على الأقل لإنشاء حساب.</li>
              <li>أنت مسؤول عن سرية كلمة المرور.</li>
              <li>يجب تأكيد البريد الإلكتروني قبل تسجيل الدخول.</li>
              <li>لا يجوز إنشاء حسابات وهمية أو انتحال هوية.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">الطلبات والدفع</h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>الدفع حاليًا عند الاستلام (COD) فقط.</li>
              <li>الأسعار معروضة بالدرهم المغربي وتشمل الضرائب.</li>
              <li>قد تتغير الأسعار دون إشعار مسبق، لكن السعر المثبت عند الطلب يُحترم.</li>
              <li>يحق للمتجر إلغاء طلب مشبوه أو احتيالي.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">الشحن والتوصيل</h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>مدة التوصيل تقديرية وتعتمد على المدينة.</li>
              <li>رسوم الشحن تُحسب حسب المنطقة وقد تختلف بين البائعين.</li>
              <li>يجب فحص المنتج عند الاستلام.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <RefreshCw className="h-5 w-5 text-[#ff5c00]" />
              الاستبدال والإرجاع
            </h2>
            <ul className="list-inside list-disc space-y-2 text-sm text-gray-700">
              <li>يمكن طلب الإرجاع خلال 7 أيام من الاستلام.</li>
              <li>يجب أن يكون المنتج في حالته الأصلية.</li>
              <li>لا تُقبل إرجاع المنتجات الشخصية أو المفتوحة (حسب النوع).</li>
              <li>تُعالج طلبات الإرجاع خلال 3-5 أيام عمل.</li>
              <li>المبالغ المُرجعة تُعاد إلى محفظة الموقع أو حساب بنكي.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-gray-900">
              <AlertTriangle className="h-5 w-5 text-[#ff5c00]" />
              المسؤولية
            </h2>
            <p className="text-sm text-gray-700">
              متجر نخبة وسيط بين البائع والمشتري. مسؤولية جودة المنتج تقع على البائع.
              المتجر يضمن أن المنصة تعمل بشكل سليم لكن لا يضمن توفر أي منتج بشكل دائم.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">الملكية الفكرية</h2>
            <p className="text-sm text-gray-700">
              جميع النصوص والشعارات والصور على الموقع مملوكة لمتجر نخبة أو للبائعين،
              ولا يجوز استخدامها تجاريًا دون إذن.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">التعديلات</h2>
            <p className="text-sm text-gray-700">
              قد نُحدّث هذه الشروط. التغييرات الجوهرية ستُنشر مع إشعار على الموقع.
              استمرارك في الاستخدام بعد النشر يعني موافقتك.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold text-gray-900">القانون المُطبَّق</h2>
            <p className="text-sm text-gray-700">
              تخضع هذه الشروط للقانون المغربي. أي نزاع يُحل عبر المحاكم المختصة في المغرب.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}