import Link from "next/link";
import {
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Camera,
  Send,
  Share2,
} from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 bg-[#111827] px-4 py-12 text-white/80">
      <div className="mx-auto max-w-7xl">
        {/* ═══════ الجزء الرئيسي: 4 أعمدة ═══════ */}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* عمود 1: الشعار */}
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-orange-500 text-lg font-black text-white">
                ن
              </span>
              <div>
                <strong className="block text-lg font-black text-white leading-none">
                  MATJAR
                </strong>
                <small className="text-[10px] font-bold tracking-[0.25em] text-orange-400">
                  NOKHBA
                </small>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/60">
              متجرك الشامل في المغرب — ملابس، إلكترونيات، منزل، جمال، وأكثر.
              شحن سريع، دفع عند الاستلام.
            </p>

            {/* معلومات التواصل */}
            <div className="mt-5 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-white/70">
                <Phone className="h-3.5 w-3.5 text-orange-400" />
                <span dir="ltr">+212 6 00 00 00 00</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Mail className="h-3.5 w-3.5 text-orange-400" />
                <span>contact@matjarnokhba.ma</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <MapPin className="h-3.5 w-3.5 text-orange-400" />
                <span>المغرب — توصيل لكل المدن</span>
              </div>
            </div>
          </div>

          {/* عمود 2: تسوق */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-white">تسوق</h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li>
                <Link href="/" className="transition hover:text-orange-400">
                  الرئيسية
                </Link>
              </li>
              <li>
                <Link
                  href="#products"
                  className="transition hover:text-orange-400"
                >
                  كل المنتجات
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  العروض
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  وصل حديثاً
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  الأكثر مبيعاً
                </Link>
              </li>
            </ul>
          </div>

          {/* عمود 3: خدمة العملاء */}
          <div>
            <h4 className="mb-4 text-sm font-bold text-white">خدمة العملاء</h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  اتصل بنا
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  سياسة الشحن
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  الاستبدال والإرجاع
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  الأسئلة الشائعة
                </Link>
              </li>
              <li>
                <Link href="#" className="transition hover:text-orange-400">
                  تتبع الطلب
                </Link>
              </li>
            </ul>
          </div>

          {/* عمود 4: تابعنا */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="mb-4 text-sm font-bold text-white">تابعنا</h4>
            <p className="text-sm text-white/60">
              كن أول من يعرف عن العروض والمنتجات الجديدة.
            </p>

            <div className="mt-4 flex gap-3">
              <a
                href="#"
                aria-label="فيسبوك"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-orange-500"
              >
                <Share2 className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="إنستغرام"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-orange-500"
              >
                <Camera className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="واتساب"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-orange-500"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="تلغرام"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition hover:bg-orange-500"
              >
                <Send className="h-4 w-4" />
              </a>
            </div>

            {/* طريقة الدفع */}
            <div className="mt-5">
              <span className="text-[10px] text-white/50">طرق الدفع المتاحة:</span>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded bg-white/10 px-2 py-1">💵 نقداً عند الاستلام</span>
                <span className="rounded bg-white/10 px-2 py-1">💳 بطاقة بنكية</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ الجزء السفلي ═══════ */}
        <div className="mt-10 flex flex-col justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center">
          <p>© {currentYear} متجر نخبة · جميع الحقوق محفوظة</p>
          <div className="flex flex-wrap gap-5">
            <Link href="#" className="transition hover:text-orange-400">
              الشروط والأحكام
            </Link>
            <Link href="#" className="transition hover:text-orange-400">
              سياسة الخصوصية
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}