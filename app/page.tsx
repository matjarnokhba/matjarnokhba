"use client";

import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";

type Category = "الكل" | "عطور" | "عناية" | "إكسسوارات";
type Product = { id: number; name: string; category: Exclude<Category, "الكل">; price: number; oldPrice?: number; rating: number; image: string; badge?: string; description: string };
type CartItem = Product & { quantity: number };

const products: Product[] = [
  { id: 1, name: "عطر ليالي العنبر", category: "عطور", price: 289, oldPrice: 350, rating: 4.9, image: "https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=900&q=85", badge: "الأكثر مبيعًا", description: "مزيج دافئ من العنبر والورد والعود بلمسة فاخرة." },
  { id: 2, name: "ساعة رويال الذهبية", category: "إكسسوارات", price: 499, rating: 4.8, image: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=85", badge: "جديد", description: "تصميم أنيق مقاوم للماء بسوار معدني مريح." },
  { id: 3, name: "طقم العناية الملكي", category: "عناية", price: 179, oldPrice: 220, rating: 4.7, image: "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=900&q=85", description: "روتين يومي متكامل لبشرة ناعمة ومشرقة." },
  { id: 4, name: "حقيبة جلد كلاسيكية", category: "إكسسوارات", price: 329, rating: 4.8, image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=85", description: "جلد نباتي فاخر ومساحة مثالية ليومك العملي." },
  { id: 5, name: "عطر نسيم المسك", category: "عطور", price: 239, rating: 4.6, image: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=900&q=85", description: "رائحة ناعمة ومنعشة تجمع المسك الأبيض والياسمين." },
  { id: 6, name: "نظارة شمسية إيطالية", category: "إكسسوارات", price: 199, oldPrice: 249, rating: 4.9, image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=900&q=85", badge: "عرض خاص", description: "عدسات حماية عالية وإطار يليق بإطلالتك اليومية." },
];
const categories: Category[] = ["الكل", "عطور", "عناية", "إكسسوارات"];
const shippingFee = 25;

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<Category>("الكل");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  useEffect(() => {
    const savedCart = window.localStorage.getItem("nukhba-cart");
    startTransition(() => {
      if (savedCart) setCart(JSON.parse(savedCart) as CartItem[]);
      setCartReady(true);
    });
  }, []);
  useEffect(() => {
    if (cartReady) window.localStorage.setItem("nukhba-cart", JSON.stringify(cart));
  }, [cart, cartReady]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const visibleProducts = products.filter((product) => {
      const matchesCategory = activeCategory === "الكل" || product.category === activeCategory;
      const matchesSearch = !normalizedSearch || `${product.name} ${product.category}`.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
    return [...visibleProducts].sort((first, second) => {
      if (sortBy === "price-low") return first.price - second.price;
      if (sortBy === "price-high") return second.price - first.price;
      if (sortBy === "rating") return second.rating - first.rating;
      return first.id - second.id;
    });
  }, [activeCategory, search, sortBy]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const total = subtotal ? subtotal + shippingFee : 0;

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...current, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  }
  function updateQuantity(id: number, change: number) {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantity = item.quantity + change;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  }
  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCart([]); setIsCheckoutOpen(false); setIsCartOpen(false); setOrderPlaced(true);
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#f7f6f2] text-[#161616]">
      <div className="bg-[#191a18] px-5 py-2 text-center text-xs text-[#eee8d9]">شحن مجاني للطلبات فوق ٤٠٠ ر.س · استبدال سهل خلال ١٤ يومًا</div>
      <header className="sticky top-0 z-30 border-b border-black/10 bg-[#f7f6f2]/95 px-5 backdrop-blur-md"><nav className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-5">
        <a href="#home" className="flex items-center gap-3" aria-label="متجر نخبة"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#c69b5e] text-xl font-black text-[#191a18]">ن</span><span><strong className="block text-lg leading-none tracking-tight">نُخبة</strong><small className="text-[10px] uppercase tracking-[0.3em] text-[#837e73]">NOKHBA STORE</small></span></a>
        <div className="hidden items-center gap-8 text-sm font-semibold md:flex"><a href="#home" className="text-[#b17f3f]">الرئيسية</a><a href="#products" className="transition hover:text-[#b17f3f]">المتجر</a><a href="#story" className="transition hover:text-[#b17f3f]">قصتنا</a></div>
        <div className="flex items-center gap-3"><label className="hidden items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#7c796f] lg:flex"><span>⌕</span><input aria-label="ابحث عن منتج" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث عن منتج..." className="w-32 bg-transparent outline-none placeholder:text-[#aaa69d]" /></label><button onClick={() => setIsCartOpen(true)} className="relative flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-lg transition hover:border-[#c69b5e]" aria-label="فتح السلة">🛒{itemCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#bd8241] px-1 text-[10px] font-bold text-white">{itemCount}</span>}</button></div>
      </nav></header>

      <div className="border-b border-black/10 bg-white px-5 py-3"><div className="mx-auto flex max-w-7xl items-center gap-3 overflow-x-auto text-sm font-bold"><span className="ml-2 shrink-0 text-xs text-[#918d84]">تسوق حسب:</span>{categories.map((category) => <button key={category} onClick={() => { setActiveCategory(category); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} className={`shrink-0 rounded-full px-4 py-2 transition ${activeCategory === category ? "bg-[#f2e3cf] text-[#9a672c]" : "text-[#716f68] hover:bg-[#f7f3ec]"}`}>{category}</button>)}<span className="mr-auto hidden shrink-0 text-xs font-normal text-[#918d84] sm:block">دفع عند الاستلام متاح</span></div></div>

      <section id="home" className="mx-auto grid max-w-7xl gap-8 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-20"><div className="order-2 lg:order-1"><span className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[#b17f3f]"><i className="h-px w-8 bg-[#b17f3f]" /> مختارات الموسم</span><h1 className="max-w-xl text-5xl font-black leading-[1.1] tracking-tight sm:text-7xl">تفاصيل صغيرة،<br /><em className="font-serif font-normal text-[#b17f3f]">حضور لا يُنسى.</em></h1><p className="mt-6 max-w-md text-base leading-8 text-[#716f68]">منتجات مختارة بعناية لمن يؤمن أن الأناقة ليست صخبًا، بل إحساسًا يبقى.</p><div className="mt-8 flex items-center gap-4"><a href="#products" className="rounded-full bg-[#1b1c1a] px-7 py-4 text-sm font-bold text-white transition hover:bg-[#b17f3f]">اكتشف المجموعة <span className="mr-2">←</span></a><span className="text-xs text-[#8d8980]">توصيل سريع داخل المملكة</span></div></div><div className="relative order-1 h-[440px] overflow-hidden rounded-[2rem] bg-[#ded5c7] lg:order-2"><img src="https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1200&q=90" alt="مجموعة عطور وإكسسوارات نخبة" className="h-full w-full object-cover" /><div className="absolute bottom-5 right-5 rounded-2xl bg-white/90 px-5 py-4 shadow-lg backdrop-blur"><span className="text-[10px] text-[#8d8980]">تشكيلة حصرية</span><strong className="mt-1 block text-sm">أناقة تدوم</strong></div></div></section>

      <section id="products" className="bg-white px-5 py-16"><div className="mx-auto max-w-7xl"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><span className="text-xs font-bold uppercase tracking-[0.2em] text-[#b17f3f]">منتجاتنا</span><h2 className="mt-2 text-3xl font-black sm:text-4xl">اختر ما يشبهك</h2><p className="mt-2 text-sm text-[#918d84]">{filteredProducts.length} منتجات متاحة الآن</p></div><div className="flex items-center gap-2"><label className="flex items-center gap-2 rounded-full border border-black/10 bg-[#faf9f6] px-4 py-2 text-sm text-[#7c796f] sm:hidden"><span>⌕</span><input aria-label="ابحث عن منتج" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث..." className="w-24 bg-transparent outline-none placeholder:text-[#aaa69d]" /></label><select aria-label="ترتيب المنتجات" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-full border border-black/10 bg-[#faf9f6] px-4 py-2.5 text-sm font-bold outline-none"><option value="featured">ترتيب: مميز</option><option value="rating">الأعلى تقييمًا</option><option value="price-low">السعر: الأقل</option><option value="price-high">السعر: الأعلى</option></select></div></div><div className="mt-10 grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">{filteredProducts.map((product) => <article key={product.id} className="group"><div className="relative aspect-[.92] overflow-hidden rounded-2xl bg-[#f3f0e9]"><img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />{product.badge && <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold backdrop-blur">{product.badge}</span>}<button onClick={() => addToCart(product)} className="absolute bottom-4 left-4 right-4 translate-y-2 rounded-xl bg-[#1b1c1a]/95 py-3 text-sm font-bold text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">أضف إلى السلة +</button></div><div className="flex items-start justify-between gap-3 pt-4"><div><h3 className="font-bold">{product.name}</h3><p className="mt-1 text-sm text-[#918d84]">{product.description}</p><span className="mt-3 inline-block text-xs text-[#b17f3f]">★ {product.rating}</span><span className="mr-3 text-[11px] text-[#918d84]">شحن سريع</span></div><div className="shrink-0 text-left"><strong className="text-lg">{product.price} ر.س</strong>{product.oldPrice && <del className="mr-1 block text-xs text-[#aaa69d]">{product.oldPrice} ر.س</del>}<button onClick={() => addToCart(product)} className="mt-3 block rounded-lg border border-[#c69b5e] px-3 py-1.5 text-xs font-bold text-[#9a672c] transition hover:bg-[#c69b5e] hover:text-white sm:hidden">أضف للسلة</button></div></div></article>)}</div>{filteredProducts.length === 0 && <p className="py-16 text-center text-[#77736a]">لم نجد منتجًا بهذا الاسم.</p>}</div></section>

      <section id="story" className="mx-auto grid max-w-7xl gap-8 px-5 py-20 md:grid-cols-3"><div><span className="text-xs font-bold uppercase tracking-[0.2em] text-[#b17f3f]">لماذا نخبة؟</span><h2 className="mt-3 text-3xl font-black">تجربة تستحق التكرار</h2></div><div className="border-t border-black/10 pt-5"><span className="text-2xl">✦</span><h3 className="mt-4 font-bold">اختيارات مدروسة</h3><p className="mt-2 text-sm leading-7 text-[#77736a]">نبحث عن القطع التي تضيف شيئًا حقيقيًا إلى يومك، لا مجرد مساحة في خزانتك.</p></div><div className="border-t border-black/10 pt-5"><span className="text-2xl">◌</span><h3 className="mt-4 font-bold">نخدمك باهتمام</h3><p className="mt-2 text-sm leading-7 text-[#77736a]">من لحظة الطلب وحتى وصوله، فريقنا هنا ليجعل التجربة أسهل وأجمل.</p></div></section>
      <footer className="bg-[#1b1c1a] px-5 py-10 text-[#eee8d9]"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><strong className="text-xl">نُخبة</strong><p className="mt-2 text-xs text-[#aaa69d]">لأنك تستحق الأفضل دائمًا.</p></div><p className="text-xs text-[#aaa69d]">© ٢٠٢٦ متجر نخبة · جميع الحقوق محفوظة</p></div></footer>

      {isCartOpen && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsCartOpen(false)}><aside onClick={(event) => event.stopPropagation()} className="absolute bottom-0 left-0 top-0 flex w-full max-w-md flex-col bg-[#fbfaf7] p-6 shadow-2xl sm:p-8"><div className="flex items-center justify-between border-b border-black/10 pb-5"><div><span className="text-xs text-[#8d8980]">مراجعة المشتريات</span><h2 className="text-2xl font-black">سلتك <span className="text-base font-normal text-[#aaa69d]">({itemCount})</span></h2></div><button onClick={() => setIsCartOpen(false)} className="text-2xl text-[#77736a]" aria-label="إغلاق السلة">×</button></div><div className="flex-1 overflow-y-auto py-5">{cart.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-center"><span className="text-5xl">🛍</span><h3 className="mt-5 font-bold">السلة فارغة</h3><p className="mt-2 text-sm text-[#8d8980]">أضف شيئًا تحبه لتبدأ.</p></div> : cart.map((item) => <div key={item.id} className="mb-5 flex gap-4"><img src={item.image} alt={item.name} className="h-24 w-20 rounded-xl object-cover" /><div className="flex flex-1 flex-col justify-between"><div className="flex justify-between gap-2"><h3 className="text-sm font-bold">{item.name}</h3><strong className="text-sm">{item.price * item.quantity} ر.س</strong></div><div className="flex items-center gap-3"><button onClick={() => updateQuantity(item.id, -1)} className="h-7 w-7 rounded-full border border-black/15">−</button><span className="text-sm">{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)} className="h-7 w-7 rounded-full border border-black/15">+</button></div></div></div>)}</div>{cart.length > 0 && <div className="border-t border-black/10 pt-5"><div className="flex justify-between text-sm text-[#77736a]"><span>المجموع الفرعي</span><span>{subtotal} ر.س</span></div><div className="mt-2 flex justify-between text-sm text-[#77736a]"><span>الشحن</span><span>{shippingFee} ر.س</span></div><div className="mt-4 flex justify-between text-lg font-black"><span>الإجمالي</span><span>{total} ر.س</span></div><button onClick={() => setIsCheckoutOpen(true)} className="mt-5 w-full rounded-xl bg-[#1b1c1a] py-4 text-sm font-bold text-white transition hover:bg-[#b17f3f]">متابعة الدفع</button></div>}</aside></div>}
      {isCheckoutOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5"><form onSubmit={submitOrder} className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-[#fbfaf7] p-6 sm:rounded-3xl sm:p-8"><div className="flex justify-between"><div><span className="text-xs text-[#8d8980]">الخطوة الأخيرة</span><h2 className="mt-1 text-2xl font-black">بيانات التوصيل</h2></div><button type="button" onClick={() => setIsCheckoutOpen(false)} className="text-2xl text-[#77736a]">×</button></div><div className="mt-6 grid gap-4"><input required placeholder="الاسم الكامل" className="rounded-xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-[#b17f3f]" /><input required type="tel" placeholder="رقم الجوال" className="rounded-xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-[#b17f3f]" /><input required placeholder="المدينة والحي والعنوان بالتفصيل" className="rounded-xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-[#b17f3f]" /><div className="rounded-xl border border-[#b17f3f] bg-[#f7f0e5] p-4 text-sm"><strong>الدفع عند الاستلام</strong><p className="mt-1 text-xs text-[#77736a]">ادفع نقدًا أو بالبطاقة عند وصول طلبك.</p></div></div><button type="submit" className="mt-6 w-full rounded-xl bg-[#1b1c1a] py-4 text-sm font-bold text-white hover:bg-[#b17f3f]">تأكيد الطلب · {total} ر.س</button></form></div>}
      {orderPlaced && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"><div className="w-full max-w-sm rounded-3xl bg-[#fbfaf7] p-8 text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dce8d7] text-3xl text-[#4f7547]">✓</span><h2 className="mt-5 text-2xl font-black">تم استلام طلبك</h2><p className="mt-3 text-sm leading-7 text-[#77736a]">شكرًا لثقتك بنخبة. سيتواصل معك فريقنا لتأكيد التوصيل قريبًا.</p><button onClick={() => setOrderPlaced(false)} className="mt-6 w-full rounded-xl bg-[#1b1c1a] py-3.5 text-sm font-bold text-white">العودة للمتجر</button></div></div>}
    </main>
  );
}
