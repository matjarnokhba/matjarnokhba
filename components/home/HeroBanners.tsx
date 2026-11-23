"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Hero from "@/components/home/Hero";

type BannerItem = {
  id: number;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  linkUrl: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
};

export default function HeroBanners() {
  const [banners, setBanners] = useState<BannerItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/banners")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setBanners(d.success && Array.isArray(d.banners) ? d.banners : []);
      })
      .catch(() => {
        if (alive) setBanners([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (banners === null) {
    return (
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        <div className="aspect-[16/9] w-full animate-pulse rounded-2xl bg-gray-200 sm:aspect-[16/5]" />
      </div>
    );
  }
  // لا بانرات فعّالة: يبقى التصميم القديم كما هو
  if (banners.length === 0) return <Hero />;
  return <BannerSlider banners={banners} />;
}

function Slide({ b, priority }: { b: BannerItem; priority: boolean }) {
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
          <div className="absolute inset-0 bg-gradient-to-l from-black/60 via-black/20 to-transparent" />
          <div
            dir="rtl"
            className="absolute inset-y-0 right-0 flex w-full max-w-[75%] flex-col justify-center gap-1.5 p-4 text-white sm:max-w-[55%] sm:gap-3 sm:p-10"
          >
            {b.title && (
              <h2 className="text-base font-black leading-tight sm:text-3xl">{b.title}</h2>
            )}
            {b.subtitle && (
              <p className="line-clamp-2 text-[11px] text-white/90 sm:text-base">{b.subtitle}</p>
            )}
            {b.buttonText && (
              <span className="mt-1 w-fit rounded-full bg-[#ff5c00] px-4 py-1.5 text-[11px] font-bold text-white shadow sm:px-6 sm:py-2 sm:text-sm">
                {b.buttonText}
              </span>
            )}
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

function BannerSlider({ banners }: { banners: BannerItem[] }) {
  const n = banners.length;
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [paused, setPaused] = useState(false);
  const startX = useRef(0);
  const moved = useRef(0);
  const width = useRef(1);
  const captured = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const go = useCallback((i: number) => setIndex(((i % n) + n) % n), [n]);

  // تحريك تلقائي كل 5 ثوانٍ (يتوقف عند اللمس/المرور أو عند تفضيل تقليل الحركة)
  useEffect(() => {
    if (n < 2 || paused || dragging) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, paused, dragging, index]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (n < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
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
    if (dragX < -th) go(index + 1);
    else if (dragX > th) go(index - 1);
    setDragX(0);
    setDragging(false);
  }

  return (
    <section
      className="mx-auto max-w-7xl px-3 py-3 sm:px-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={boxRef}
        dir="ltr"
        className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-2xl bg-gray-100 shadow-sm sm:aspect-[16/5]"
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
            transform: `translateX(calc(${-index * 100}% + ${dragX}px))`,
            transition: dragging ? "none" : "transform 500ms ease",
          }}
        >
          {banners.map((b, i) => (
            <div key={b.id} className="h-full w-full shrink-0" aria-hidden={i !== index}>
              <Slide b={b} priority={i === 0} />
            </div>
          ))}
        </div>

        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="السابق"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => go(index - 1)}
              className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow transition hover:bg-white sm:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="التالي"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => go(index + 1)}
              className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow transition hover:bg-white sm:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`بانر ${i + 1}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => go(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-5 bg-[#ff5c00]" : "w-1.5 bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}