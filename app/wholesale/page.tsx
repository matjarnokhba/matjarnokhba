import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Building2, Factory, Truck, Users, Package, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WholesaleLandingPage() {
  const [suppliersCount, offersCount, citiesCount] = await Promise.all([
    prisma.wholesaleSupplier.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.sellerOffer.count({
      where: {
        isActive: true,
        deletedAt: null,
        supplier: { status: "ACTIVE", deletedAt: null },
      },
    }),
    prisma.wholesaleSupplier
      .findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: { city: true },
        distinct: ["city"],
      })
      .then((rows) => rows.length),
  ]);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-sm font-black text-white">ن</span>
            <strong className="text-sm font-black">متجر نخبة</strong>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">دخول</Link>
            <Link href="/wholesale/register" className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600">تسجيل جديد</Link>
          </div>
        </div>
      </header>

      <section className="bg-gradient-to-b from-orange-50 to-gray-50 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block rounded-full bg-orange-100 px-4 py-1 text-xs font-bold text-orange-700 mb-4">🏭 منصة الجملة</span>
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-4">
            اربط شركتك أو مصنعك<br />
            <span className="text-orange-500">بآلاف التجار</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            اعرض منتجاتك على تجار معتمدين، استقبل الطلبات، وأدر أعمالك من لوحة تحكم احترافية.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/wholesale/register" className="rounded-xl bg-orange-500 px-8 py-3 font-bold text-white hover:bg-orange-600 shadow-lg transition">سجّل شركتك الآن</Link>
            <Link href="/login" className="rounded-xl border-2 border-gray-200 bg-white px-8 py-3 font-bold text-gray-700 hover:bg-gray-50 transition">لدي حساب — دخول</Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-black text-center mb-8">لمن هذه المنصة؟</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: Building2, title: "الشركات", desc: "شركات توزيع أو تجارة تريد التوسع في قنوات البيع", color: "from-blue-500 to-blue-600" },
              { icon: Factory, title: "المصانع", desc: "مصانع تريد بيع منتجاتها مباشرة للتجار دون وسطاء", color: "from-purple-500 to-purple-600" },
              { icon: Truck, title: "الموردون", desc: "موزعون وموردون معتمدون لديهم شبكة منتجات", color: "from-orange-500 to-amber-500" },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl bg-white border border-gray-200 p-6 hover:shadow-lg transition">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${c.color}`}>
                  <c.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mt-4 text-lg font-black">{c.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 px-4 border-y border-gray-200">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-black text-center mb-12">كيف يعمل؟</h2>
          <div className="space-y-6">
            {[
              { n: 1, title: "سجّل شركتك", desc: "أدخل بياناتك وحدد موقع شركتك على الخريطة" },
              { n: 2, title: "وثّق حسابك", desc: "فريق الإدارة يراجع طلبك ويوثّقه في أقل من 24 ساعة" },
              { n: 3, title: "اعرض منتجاتك", desc: "أضف هويات المنتجات والأسعار والمخزون" },
              { n: 4, title: "استقبل الطلبات", desc: "التجار يطلبون عبر المنصة، وأنت توافق وتشحن" },
            ].map((s) => (
              <div key={s.n} className="flex gap-4 items-start">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-black text-white">{s.n}</span>
                <div>
                  <h3 className="font-bold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
              <Users className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <div className="text-3xl font-black text-gray-900">{suppliersCount}</div>
              <div className="text-xs text-gray-500 mt-1">مورد نشط</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
              <Package className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <div className="text-3xl font-black text-gray-900">{offersCount}</div>
              <div className="text-xs text-gray-500 mt-1">عرض معروض</div>
            </div>
            <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center">
              <MapPin className="h-8 w-8 mx-auto text-orange-500 mb-2" />
              <div className="text-3xl font-black text-gray-900">{citiesCount}</div>
              <div className="text-xs text-gray-500 mt-1">مدينة مغطاة</div>
            </div>
          </div>
          {suppliersCount < 5 && (
            <p className="text-center text-xs text-gray-500 mt-4">منصة في طور النمو — كن من الأوائل</p>
          )}
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 p-8 text-center text-white shadow-xl">
          <h2 className="text-2xl font-black mb-2">جاهز للبدء؟</h2>
          <p className="text-sm opacity-90 mb-6">التسجيل مجاني. لن تحتاج بطاقة ائتمانية.</p>
          <Link href="/wholesale/register" className="inline-block rounded-xl bg-white px-8 py-3 font-bold text-orange-600 hover:bg-gray-50 transition">سجّل الآن</Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        © 2026 متجر نخبة. جميع الحقوق محفوظة.
      </footer>
    </div>
  );
}