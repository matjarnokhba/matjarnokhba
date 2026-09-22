import { CURRENCY, FREE_SHIPPING_THRESHOLD } from "@/lib/data/products";

export default function PromoBanners() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="grid gap-4 md:grid-cols-2">
        {/* بانر 1 — خصم */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-[#b17f3f] to-[#9a672c] p-8 text-white">
          <div className="relative z-10">
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
              عرض محدود
            </span>
            <h3 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              خصم 15% على أول طلب
            </h3>
            <p className="mt-3 text-sm opacity-90">
              استخدم كود الخصم عند إتمام الشراء
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 font-mono text-sm font-bold backdrop-blur">
              <span className="text-[10px] font-normal opacity-80">الكود:</span>
              WELCOME15
            </div>
          </div>
          <div className="absolute -left-10 -bottom-10 text-[180px] opacity-10 select-none">
            🎁
          </div>
        </div>

        {/* بانر 2 — شحن مجاني */}
        <div className="relative overflow-hidden rounded-2xl bg-[#191a18] p-8 text-white">
          <div className="relative z-10">
            <span className="inline-block rounded-full bg-[#c69b5e]/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#c69b5e] backdrop-blur">
              لجميع مدن المملكة
            </span>
            <h3 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
              شحن مجاني
            </h3>
            <p className="mt-3 text-sm opacity-80">
              للطلبات فوق {FREE_SHIPPING_THRESHOLD} {CURRENCY}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#c69b5e]/20 px-4 py-2 text-sm font-bold text-[#c69b5e]">
              🚚 توصيل سريع خلال 24-48 ساعة
            </div>
          </div>
          <div className="absolute -left-10 -bottom-10 text-[180px] opacity-10 select-none">
            🚚
          </div>
        </div>
      </div>
    </section>
  );
}