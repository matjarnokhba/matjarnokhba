import Link from "next/link";
import { SessionService } from "@/services/session.service";
import { prisma } from "@/lib/prisma";
import {
  Building2, ShoppingBag, Package, ArrowRight, TrendingUp, ShieldCheck,
  Users, Warehouse, Handshake, Layers, FileText, Receipt,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WholesaleLandingPage() {
  const current = await SessionService.getCurrent();

  const [businessesCount, offersCount, ordersCount] = await Promise.all([
    prisma.business.count({ where: { status: "VERIFIED", deletedAt: null } }),
    prisma.wholesaleOffer.count({
      where: { isActive: true, claimVerified: true, status: "ACTIVE", deletedAt: null },
    }),
    prisma.wholesaleOrder.count({ where: { status: "COMPLETED" } }),
  ]);

  const features = [
    { Icon: Building2, title: "هويات تجارية متعددة", desc: "مصنع، شركة، مورد، مستورد، أو تاجر جملة — كل نشاط بهويته ومخزونه ودفتره المستقل." },
    { Icon: ShoppingBag, title: "سوق جملة ذكي", desc: "تصفح المنتجات حسب النوع والمدينة والتصنيف، قارن الأسعار، واطلب بضغطة زر." },
    { Icon: Layers, title: "شرائح أسعار مرنة", desc: "أسعار مختلفة حسب الكميات (10-49، 50-99، 100+) تطبق تلقائياً على طلباتك." },
    { Icon: Handshake, title: "دورة شراء كاملة", desc: "من طلب إلى قبول إلى تجهيز إلى شحن إلى تسليم — مع سجل كامل لكل خطوة." },
    { Icon: Receipt, title: "دفتر حسابات وديون", desc: "كل معاملة تُسجَّل تلقائياً — أرصدتك، مدفوعاتك، ديونك — في مكان واحد." },
    { Icon: Warehouse, title: "استيراد فوري للتجزئة", desc: "اشترِ بالجملة، ثم أضف المنتج لمتجرك بضغطة زر — مع تتبع المصدر الأصلي." },
    { Icon: ShieldCheck, title: "توثيق ومراجعة", desc: "كل نشاط يمر بمراجعة الإدارة قبل ظهوره. مطالبات العروض موثقة." },
    { Icon: FileText, title: "فواتير ومرتجعات", desc: "فواتير قابلة للطباعة، نظام مرتجعات كامل مع استرداد مالي موثق." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <ShoppingBag className="h-6 w-6 text-orange-500" />
            <span>سوق الجملة</span>
          </Link>
          <div className="flex items-center gap-3">
            {current ? (
              <>
                <Link href="/business" className="text-sm text-gray-700 hover:text-gray-900">أنشطتي</Link>
                <Link href="/marketplace" className="rounded-lg bg-orange-500 text-white px-4 py-2 text-sm hover:bg-orange-600">تصفح السوق</Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-700 hover:text-gray-900">دخول</Link>
                <Link href="/register" className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">حساب جديد</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 text-orange-700 px-4 py-1.5 text-sm mb-6">
          <TrendingUp className="h-4 w-4" />
          منصة B2B للمصنعين والشركات والتجار
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          سوق الجملة <span className="text-orange-500">المتكامل</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          اربط مصنعك أو شركتك أو متجرك بآلاف التجار. اشترِ بالجملة، أعد البيع، وأدر كل معاملاتك من مكان واحد — بمخزون مستقل ودفتر حسابات تلقائي.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/marketplace" className="rounded-lg bg-orange-500 text-white px-8 py-3 font-medium hover:bg-orange-600 flex items-center justify-center gap-2">
            تصفح سوق الجملة <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href={current ? "/business/new" : "/register"} className="rounded-lg border-2 border-gray-300 px-8 py-3 font-medium hover:border-orange-500 hover:text-orange-600 flex items-center justify-center gap-2">
            {current ? "أنشئ نشاطك التجاري" : "ابدأ الآن"}
          </Link>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-white border p-6 text-center">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-orange-500" />
            <p className="text-3xl font-bold">{businessesCount}</p>
            <p className="text-sm text-gray-600">نشاط موثق</p>
          </div>
          <div className="rounded-xl bg-white border p-6 text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-orange-500" />
            <p className="text-3xl font-bold">{offersCount}</p>
            <p className="text-sm text-gray-600">عرض جملة نشط</p>
          </div>
          <div className="rounded-xl bg-white border p-6 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-orange-500" />
            <p className="text-3xl font-bold">{ordersCount}</p>
            <p className="text-sm text-gray-600">طلب مكتمل</p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-2">ماذا يقدم سوق الجملة؟</h2>
        <p className="text-center text-gray-600 mb-10">منظومة تجارية متكاملة، ليست مجرد قائمة منتجات</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => {
            const Icon = f.Icon;
            return (
              <div key={f.title} className="rounded-xl bg-white border p-5 hover:shadow-md transition-shadow">
                <Icon className="h-8 w-8 text-orange-500 mb-3" />
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center mb-8">كيف تبدأ؟</h2>
        <div className="space-y-4">
          {[
            { n: 1, title: "سجّل حساباً", desc: "حساب واحد يخدمك كتاجر تجزئة، أو صاحب مصنع، أو كليهما" },
            { n: 2, title: "أنشئ نشاطك التجاري", desc: "اختر النوع (مصنع/شركة/مورد/مستورد/تاجر جملة) وأدخل بياناتك" },
            { n: 3, title: "احصل على التوثيق", desc: "فريق الإدارة يراجع نشاطك، وبعد الموافقة يظهر في السوق" },
            { n: 4, title: "ابدأ البيع والشراء", desc: "اعرض منتجاتك، اشترِ من الآخرين، أدر مخزونك وحساباتك" },
          ].map((s) => (
            <div key={s.n} className="flex gap-4 items-start rounded-xl bg-white border p-5">
              <div className="h-10 w-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold flex-shrink-0">{s.n}</div>
              <div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white p-10 text-center">
          <h2 className="text-3xl font-bold mb-3">جاهز للانضمام؟</h2>
          <p className="text-orange-50 mb-6">انضم إلى منصة تربط بين الصناعة والتجارة</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/marketplace" className="rounded-lg bg-white text-orange-600 px-8 py-3 font-medium hover:bg-orange-50 inline-flex items-center justify-center gap-2">
              تصفح السوق الآن <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={current ? "/business/new" : "/register"} className="rounded-lg border-2 border-white px-8 py-3 font-medium hover:bg-white/10 inline-flex items-center justify-center">
              {current ? "أضف نشاطاً" : "أنشئ حساباً"}
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t mt-8 py-6 text-center text-sm text-gray-500">
        <p>سوق الجملة — جزء من منصة السوق</p>
      </footer>
    </div>
  );
}