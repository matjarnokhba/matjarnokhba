"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Hero from "@/components/home/Hero";

// ⏱ مدة بقاء كل شريحة (بالميلي ثانية) ومدة الانزلاق
const AUTOPLAY_MS = 2000;
const SLIDE_MS = 600;

type BannerItem = {
  id: number;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
};

// banner = null تعني اللافتة الأصلية (Hero)
type SlideData = { key: string; banner: BannerItem | null };

export default function HeroBanners() {
  const [banners, setBanners] = useState<BannerItem[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/banners")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.success && Array.isArray(d.banners)) setBanners(d.banners);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // لا بانرات: اللافتة الأصلية وحدها كما كانت
  if (banners.length === 0) return <Hero />;
  return <Slider banners={banners} />;
}

function BannerSlide({ b, priority }: { b: BannerItem; priority: boolean }) {
  const hasText = !!(b.title || b.subtitle || b.buttonText);
  const inner = (
    <div className="relative h-full w-full">
      <picture className="block h-full w-full">
        {b.mobileImageUrl && <source media="(max-width: 639px)" srcSet={b.mobileImageUrl} />}
        <img
          src={b.imageUrl}
          alt={b.title || "بانر إعلاني"}
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </picture>
      {hasText && (
        <>
          <div className="absolute inset-0 bg-gradient-to-l from-black/65 via-black/25 to-transparent" />
          <div className="absolute inset-0 z-10">
            <div dir="rtl" className="mx-auto flex h-full max-w-7xl items-center px-4 text-white sm:px-6">
              <div className="flex max-w-[72%] flex-col items-start gap-1 sm:max-w-[50%] sm:gap-2">
                {b.title && (
                  <h2 className="text-sm font-black leading-tight sm:text-2xl lg:text-4xl">{b.title}</h2>
                )}
                {b.subtitle && (
                  <p className="line-clamp-1 text-[10px] text-white/90 sm:line-clamp-2 sm:text-base">
                    {b.subtitle}
                  </p>
                )}
                {b.buttonText && (
                  <span className="mt-0.5 rounded-full bg-[#ff5c00] px-3 py-1 text-[10px] font-bold text-white shadow sm:px-6 sm:py-2 sm:text-sm">
                    {b.buttonText}
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (!b.linkUrl) return <div className="h-full w-full">{inner}</div>;
  if (b.linkUrl.startsWith("/")) {
    return (
      <Link href={b.linkUrl} draggable={false} className="block h-full w-full">
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={b.linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      className="block h-full w-full"
    >
      {inner}
    </a>
  );
}

function SlideView({ data, priority }: { data: SlideData; priority: boolean }) {
  if (data.banner) return <BannerSlide b={data.banner} priority={priority} />;
  // اللافتة الأصلية: تملأ ارتفاع الشريط وتتوسط عمودياً دون تعديل ملفها
  return (
    <div className="h-full w-full [&>section]:flex [&>section]:h-full [&>section]:items-center [&>section>div:last-child]:w-full">
      <Hero />
    </div>
  );
}

function Slider({ banners }: { banners: BannerItem[] }) {
  const slides: SlideData[] = [
    { key: "hero", banner: null },
    ...banners.map((b) => ({ key: `b${b.id}`, banner: b })),
  ];
  const n = slides.length; // دائماً >= 2
  // نسخة من الأخيرة في البداية ونسخة من الأولى في النهاية لدوران سلس بلا قفزة
  const ext: SlideData[] = [
    { ...slides[n - 1], key: "clone-last" },
    ...slides,
    { ...slides[0], key: "clone-first" },
  ];

  const [pos, setPos] = useState(1);
  const [anim, setAnim] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const startX = useRef(0);
  const moved = useRef(0);
  const width = useRef(1);
  const captured = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (delta: number) => setPos((p) => Math.max(0, Math.min(n + 1, p + delta))),
    [n]
  );

  // عند الوصول إلى النسخة: قفز فوري (بلا حركة) إلى الشريحة الحقيقية المطابقة
  useEffect(() => {
    if (pos >= 1 && pos <= n) return;
    const t = setTimeout(() => {
      setAnim(false);
      setPos(pos > n ? 1 : n);
    }, SLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [pos, n]);

  // إعادة تفعيل الحركة بعد القفزة
  useEffect(() => {
    if (anim) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setAnim(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [anim]);

  // تبديل تلقائي
  useEffect(() => {
    if (paused || dragging || !anim) return;
    const t = setTimeout(() => setPos((p) => Math.min(p + 1, n + 1)), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [pos, paused, dragging, anim, n]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pos < 1 || pos > n) {
      setAnim(false);
      setPos(pos > n ? 1 : n);
    }
    startX.current = e.clientX;
    moved.current = 0;
    captured.current = false;
    width.current = boxRef.current?.offsetWidth || 1;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    moved.current = Math.max(moved.current, Math.abs(dx));
    if (!captured.current && Math.abs(dx) > 6) {
      captured.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
    }
    setDragX(dx);
  }

  function endDrag() {
    if (!dragging) return;
    const th = Math.min(80, width.current * 0.2);
    if (dragX < -th) go(1);
    else if (dragX > th) go(-1);
    setDragX(0);
    setDragging(false);
  }

  const active = (((pos - 1) % n) + n) % n;

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={boxRef}
        dir="ltr"
        className="relative aspect-[25/9] min-h-[128px] w-full select-none overflow-hidden bg-[#0a1a35] sm:aspect-[4/1] sm:max-h-[300px] sm:min-h-[152px] lg:aspect-[5/1] lg:min-h-[170px]"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (moved.current > 6) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div
          className="flex h-full w-full"
          style={{
            transform: `translateX(calc(${-pos * 100}% + ${dragX}px))`,
            transition: dragging || !anim ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            willChange: "transform",
          }}
        >
          {ext.map((s, i) => (
            <div key={s.key} className="h-full w-full shrink-0">
              <SlideView data={s} priority={i <= 2} />
            </div>
          ))}
        </div>

        <button
          type="button"
          aria-label="السابق"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow transition hover:bg-white sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="التالي"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow transition hover:bg-white sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-1.5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:bottom-2">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`شريحة ${i + 1}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setPos(i + 1)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-[#ff5c00]" : "w-1.5 bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}