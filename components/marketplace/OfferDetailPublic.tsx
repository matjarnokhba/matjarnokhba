"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Package as PackageIcon,
  ShieldCheck,
  Building2,
  Star,
  CheckCircle2,
  ShoppingCart,
  AlertCircle,
  Layers,
  Plus,
  Minus,
  Boxes,
  X,
  Link2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CLAIM_TYPE_LABEL,
  BU_TYPE_LABEL,
  formatDate,
  formatMoney,
} from "@/components/wholesale/offers/types";
import type { PublicOfferDetail, BuyerBU } from "./types";
import { useWholesaleCart } from "@/lib/hooks/useWholesaleCart";
import { useToast } from "@/lib/hooks/useToast";

function fmtAttrs(attrs?: Array<{ name: string; value: string }>): string {
  if (!attrs || attrs.length === 0) return "افتراضي";
  return attrs.map((a) => `${a.name}: ${a.value}`).join(" · ");
}

export interface OfferDetailPublicProps {
  offer: PublicOfferDetail;
  buyerBUs: BuyerBU[];
  isOwnOffer: boolean;
}

type BundlePromptRow = {
  variantId: number;
  label: string;
  needed: number;
  current: number;
  delta: number;
  stock: number;
  wouldExceed: boolean;
};

type BundlePrompt = {
  triggerVariantId: number;
  triggerLabel: string;
  newTriggerQty: number;
  rows: BundlePromptRow[];
};

export function OfferDetailPublic({
  offer,
  buyerBUs,
  isOwnOffer,
}: OfferDetailPublicProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [packageFeedback, setPackageFeedback] = useState("");
  const [bundlePrompt, setBundlePrompt] = useState<BundlePrompt | null>(null);
  const [autoBalanceTotal, setAutoBalanceTotal] = useState<string>("");
  const [autoBalanceLoading, setAutoBalanceLoading] = useState(false);
  const [autoBalanceError, setAutoBalanceError] = useState("");
  const [minDistributed, setMinDistributed] = useState<number>(0);
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [blockedVariants, setBlockedVariants] = useState<Set<number>>(new Set());
  const [rareCaps, setRareCaps] = useState<Record<number, number>>({});
  const router = useRouter();
  const { toast } = useToast();
  const { addItem } = useWholesaleCart();

  // M10.6 + M10.7b: dynamic max — block non-selected sizes, cap rare variants
  const maxFor = useCallback((variantId: number): number => {
    if (blockedVariants.has(variantId)) return 0;
    const v = offer.variants.find((x) => x.id === variantId);
    if (!v) return 0;
    const stockMax = v.availableStock ?? 0;
    if (!offer.autoBalanceEnabled) return stockMax;
    if (!rareCaps[variantId]) return stockMax;

    const nonRareQtys: number[] = [];
    for (const ov of offer.variants) {
      if (rareCaps[ov.id]) continue;
      if (blockedVariants.has(ov.id)) continue;
      const q = quantities[ov.id] || 0;
      if (q > 0) nonRareQtys.push(q);
    }
    if (nonRareQtys.length === 0) return 0;
    return Math.min(stockMax, Math.min(...nonRareQtys));
  }, [offer.variants, offer.autoBalanceEnabled, rareCaps, quantities, blockedVariants]);

  // M10.7b: extract available sizes from variant attributes
  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    for (const v of offer.variants) {
      for (const a of v.attributes) {
        const n = a.name.toLowerCase().trim();
        if (n.includes("مقاس") || n.includes("size")) {
          if (a.value) set.add(a.value);
        }
      }
    }
    return Array.from(set).sort();
  }, [offer.variants]);
  // M10.4: fetch auto-balance distribution on total change
  useEffect(() => {
    if (!offer.autoBalanceEnabled) return;
    if (offer.requireSizeSelection && availableSizes.length > 0 && selectedSizes.size === 0) {
      setMinDistributed(0);
      setRareCaps({});
      setBlockedVariants(new Set());
      return;
    }
    const t = parseInt(autoBalanceTotal, 10);
    if (!t || t < 1) {
      setMinDistributed(0);
      setRareCaps({});
      setBlockedVariants(new Set());
      return;
    }
    const timer = setTimeout(async () => {
      setAutoBalanceLoading(true);
      setAutoBalanceError("");
      try {
        const sizesParam =
          selectedSizes.size > 0
            ? `&sizes=${encodeURIComponent(Array.from(selectedSizes).join(","))}`
            : "";
        const res = await fetch(
          `/api/wholesale/offers/${offer.id}/auto-balance/compute?qty=${t}${sizesParam}`
        );
        const d = await res.json();
        if (!d.success) {
          setAutoBalanceError(d.message || "فشل التوزيع");
          return;
        }
        const nextQty: Record<number, number> = {};
        const nextCaps: Record<number, number> = {};
        const nextBlocked = new Set<number>();
        for (const v of d.variants as Array<{
          variantId: number;
          suggestedQty: number;
          isRare: boolean;
          isBlocked: boolean;
          maxAllowed: number;
        }>) {
          if (v.suggestedQty > 0) nextQty[v.variantId] = v.suggestedQty;
          if (v.isRare) nextCaps[v.variantId] = v.maxAllowed;
          if (v.isBlocked) nextBlocked.add(v.variantId);
        }
        setQuantities(nextQty);
        setRareCaps(nextCaps);
        setBlockedVariants(nextBlocked);
        setMinDistributed(d.minDistributed || 0);
      } catch {
        setAutoBalanceError("خطأ في الاتصال");
      } finally {
        setAutoBalanceLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [autoBalanceTotal, selectedSizes, availableSizes.length, offer.id, offer.autoBalanceEnabled, offer.requireSizeSelection]);
  const totalQty = useMemo(() => {
    let sum = 0;
    for (const v of offer.variants) sum += quantities[v.id] || 0;
    return sum;
  }, [quantities, offer.variants]);

  const variantPrices = useMemo(() => {
    const map = new Map<number, number>();
    for (const v of offer.variants) {
      const qty = quantities[v.id] || 0;
      if (qty <= 0) continue;
      let tier = v.tiers.find(
        (t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)
      );
      if (!tier && v.tiers.length > 0) tier = v.tiers[0];
      if (tier) map.set(v.id, tier.unitPrice);
    }
    return map;
  }, [quantities, offer.variants]);

  const totalEstimate = useMemo(() => {
    let total = 0;
    for (const v of offer.variants) {
      const p = variantPrices.get(v.id);
      if (p === undefined) continue;
      total += p * (quantities[v.id] || 0);
    }
    return Math.round(total * 100) / 100;
  }, [variantPrices, quantities, offer.variants]);

  const bundleViolations = useMemo(() => {
    const violations: string[] = [];
    for (const rule of offer.bundleRules || []) {
      const triggerQty = quantities[rule.triggerVariantId] || 0;
      if (triggerQty === 0) continue;
      const requiredQty = quantities[rule.requiredVariantId] || 0;
      const neededQty = rule.isMultiplied
        ? triggerQty * rule.minQuantity
        : rule.minQuantity;
      if (requiredQty < neededQty) {
        const tv = offer.variants.find((v) => v.id === rule.triggerVariantId);
        const rv = offer.variants.find((v) => v.id === rule.requiredVariantId);
        violations.push(
          `شراء "${fmtAttrs(tv?.attributes)}" يستلزم ${neededQty} على الأقل من "${fmtAttrs(rv?.attributes)}"${rule.isMultiplied ? ` (${triggerQty}×${rule.minQuantity})` : ""} — لديك: ${requiredQty}`
        );
      }
    }
    return violations;
  }, [quantities, offer.bundleRules, offer.variants]);

  const bundleHints = useMemo(() => {
    const hints = new Map<number, string[]>();
    for (const rule of offer.bundleRules || []) {
      const triggerQty = quantities[rule.triggerVariantId] || 0;
      if (triggerQty === 0) continue;
      const requiredQty = quantities[rule.requiredVariantId] || 0;
      const neededQty = rule.isMultiplied
        ? triggerQty * rule.minQuantity
        : rule.minQuantity;
      if (requiredQty < neededQty) {
        const tv = offer.variants.find((v) => v.id === rule.triggerVariantId);
        const existing = hints.get(rule.requiredVariantId) || [];
        existing.push(
          `مطلوب ≥${neededQty} بسبب "${fmtAttrs(tv?.attributes)}"${rule.isMultiplied ? " (نسبة)" : ""}`
        );
        hints.set(rule.requiredVariantId, existing);
      }
    }
    return hints;
  }, [quantities, offer.bundleRules, offer.variants]);

  const minMet = totalQty === 0 || totalQty >= offer.minOrderQty;
  const maxExceeded = offer.maxOrderQty !== null && totalQty > offer.maxOrderQty;

  const canOrder =
    !isOwnOffer &&
    buyerBUs.length > 0 &&
    totalQty > 0 &&
    minMet &&
    !maxExceeded &&
    bundleViolations.length === 0;

  /**
   * Compute bundle prompt for incrementing a variant.
   * Returns null if no rules apply, or a prompt if any delta needed.
   */
  function buildBundlePrompt(variantId: number): BundlePrompt | null {
    const rules = (offer.bundleRules || []).filter(
      (r) => r.triggerVariantId === variantId
    );
    if (rules.length === 0) return null;

    const currentTrigger = quantities[variantId] || 0;
    const newTriggerQty = currentTrigger + 1;
    const triggerVar = offer.variants.find((v) => v.id === variantId);

    const rows: BundlePromptRow[] = [];
    let anyDelta = false;

    for (const rule of rules) {
      const current = quantities[rule.requiredVariantId] || 0;
      const needed = rule.isMultiplied
        ? newTriggerQty * rule.minQuantity
        : rule.minQuantity;
      const delta = Math.max(0, needed - current);
      const rv = offer.variants.find((v) => v.id === rule.requiredVariantId);
      const stock = rv?.availableStock ?? 0;
      const wouldExceed = current + delta > stock;
      if (delta > 0) anyDelta = true;
      rows.push({
        variantId: rule.requiredVariantId,
        label: fmtAttrs(rv?.attributes),
        needed,
        current,
        delta,
        stock,
        wouldExceed,
      });
    }

    if (!anyDelta) return null;

    return {
      triggerVariantId: variantId,
      triggerLabel: fmtAttrs(triggerVar?.attributes),
      newTriggerQty,
      rows,
    };
  }

  function increment(variantId: number) {
    const max = maxFor(variantId);
    const cur = quantities[variantId] || 0;
    if (cur >= max) return;

    if (!offer.autoBalanceEnabled) {
      const prompt = buildBundlePrompt(variantId);
      if (prompt) {
        setBundlePrompt(prompt);
        return;
      }
    }

    setQuantities((p) => ({ ...p, [variantId]: cur + 1 }));
    setPackageFeedback("");
  }

  function confirmBundlePrompt() {
    if (!bundlePrompt) return;
    const next = { ...quantities };
    next[bundlePrompt.triggerVariantId] = bundlePrompt.newTriggerQty;
    for (const row of bundlePrompt.rows) {
      if (row.delta > 0) {
        next[row.variantId] = row.current + row.delta;
      }
    }
    setQuantities(next);
    setBundlePrompt(null);
    setPackageFeedback("");
  }

  function cancelBundlePrompt() {
    setBundlePrompt(null);
  }

  function decrement(variantId: number) {
    const cur = quantities[variantId] || 0;
    if (cur <= 0) return;
    setQuantities((p) => {
      const next = { ...p };
      if (cur - 1 === 0) delete next[variantId];
      else next[variantId] = cur - 1;
      return next;
    });
    setPackageFeedback("");
  }

  // M10.6: when auto-balance enabled and delta >= 2, redistribute
  function redistributeLocked(lockedVariantId: number, lockedQty: number) {
    const totalAfter = Object.entries(quantities).reduce((sum, [vid, q]) => {
      return sum + (parseInt(vid, 10) === lockedVariantId ? lockedQty : q);
    }, 0);
    if (totalAfter < 1) return;

    const params = new URLSearchParams({
      qty: String(totalAfter),
      lockedVariantId: String(lockedVariantId),
      lockedQty: String(lockedQty),
    });
    fetch(`/api/wholesale/offers/${offer.id}/auto-balance/compute?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        const nextQty: Record<number, number> = {};
        const nextCaps: Record<number, number> = {};
        for (const v of d.variants as Array<{
          variantId: number;
          suggestedQty: number;
          isRare: boolean;
          maxAllowed: number;
        }>) {
          if (v.suggestedQty > 0) nextQty[v.variantId] = v.suggestedQty;
          if (v.isRare) nextCaps[v.variantId] = v.maxAllowed;
        }
        setQuantities(nextQty);
        setRareCaps(nextCaps);
        setMinDistributed(d.minDistributed || 0);
        setPackageFeedback("تم إعادة التوزيع تلقائياً");
        setTimeout(() => setPackageFeedback(""), 3000);
      })
      .catch(() => {});
  }

  function setDirect(variantId: number, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    const max = maxFor(variantId);
    let n = raw === "" ? 0 : parseInt(raw, 10);
    if (n > max) n = max;

    const oldQty = quantities[variantId] || 0;
    const delta = n - oldQty;

    // Auto-redistribute if delta >= 2 and non-rare and auto-balance on
    if (offer.autoBalanceEnabled && !rareCaps[variantId] && Math.abs(delta) >= 2) {
      // Stage the change first
      setQuantities((p) => {
        const next = { ...p };
        if (n === 0) delete next[variantId];
        else next[variantId] = n;
        return next;
      });
      redistributeLocked(variantId, n);
      return;
    }

    setQuantities((p) => {
      const next = { ...p };
      if (n === 0) delete next[variantId];
      else next[variantId] = n;
      return next;
    });
    setPackageFeedback("");
  }

  function toggleSize(size: string) {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return next;
    });
    setQuantities({});
    setRareCaps({});
    setBlockedVariants(new Set());
    setMinDistributed(0);
  }

  function clearAll() {
    setQuantities({});
    setPackageFeedback("");
  }

  function applyPackage(pkg: { name: string; items: Array<{ variantId: number; quantity: number }> }) {
    const next = { ...quantities };
    let capped = false;
    for (const item of pkg.items) {
      const max = maxFor(item.variantId);
      const cur = next[item.variantId] || 0;
      const want = cur + item.quantity;
      if (want > max) {
        next[item.variantId] = max;
        capped = true;
      } else {
        next[item.variantId] = want;
      }
    }
    setQuantities(next);
    setPackageFeedback(
      capped
        ? `أضيفت "${pkg.name}" — بعض الخيارات تجاوزت المخزون فتم تحديدها بالحد الأقصى`
        : `أضيفت "${pkg.name}"`
    );
    setTimeout(() => setPackageFeedback(""), 4000);
  }

  function handleAddToCart() {
    if (!canOrder) return;
    let added = 0;
    for (const v of offer.variants) {
      const qty = quantities[v.id] || 0;
      if (qty <= 0) continue;
      const price = variantPrices.get(v.id);
      if (price === undefined) continue;
      addItem({
        offerId: offer.id,
        masterVariantId: v.masterVariantId,
        masterName: offer.masterName,
        masterImage: offer.masterImage,
        sellerName: offer.sellerName,
        sellerType: offer.sellerType,
        variantAttributes: v.attributes,
        quantity: qty,
        unitPrice: price,
        minOrderQty: 1,
        maxOrderQty: null,
      });
      added++;
    }
    toast(`تمت إضافة ${added} ${added === 1 ? "خيار" : "خيارات"} إلى السلة`, "success");
    router.push("/wholesale/cart");
  }

  const selectedCount = Object.values(quantities).filter((q) => q > 0).length;
  const hasBlockingRow = bundlePrompt?.rows.some((r) => r.wouldExceed) ?? false;

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/marketplace"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للسوق
      </Link>

      <PageHeader
        title={offer.master.name}
        description={`${offer.master.brand || "بدون علامة"} · ${offer.sellerName}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {offer.claimVerified && (
              <Badge variant="green">
                <ShieldCheck className="h-3 w-3" /> موثق
              </Badge>
            )}
            <Badge variant="gray">
              <Star className="h-3 w-3" />
              {CLAIM_TYPE_LABEL[offer.claimType] ?? offer.claimType}
            </Badge>
          </div>
        }
      />

      {isOwnOffer && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="inline h-4 w-4" /> هذا عرضك — لا يمكنك شراء منتجك الخاص.
        </div>
      )}
      {!isOwnOffer && buyerBUs.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="inline h-4 w-4" /> تحتاج نشاطًا بصلاحية الشراء بالجملة.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="mb-3 flex aspect-square max-h-[400px] items-center justify-center overflow-hidden rounded-lg bg-gray-50">
              {offer.master.images[activeImage] ? (
                <img
                  src={offer.master.images[activeImage]}
                  alt={offer.master.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <PackageIcon className="h-20 w-20 text-gray-300" />
              )}
            </div>
            {offer.master.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {offer.master.images.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(idx)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      idx === activeImage ? "border-[#ff5c00]" : "border-gray-200"
                    }`}
                  >
                    <img src={url} alt={`صورة ${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {offer.master.description && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">الوصف</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{offer.master.description}</p>
            </Card>
          )}

          {offer.packages && offer.packages.length > 0 && (
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Boxes className="h-4 w-4 text-[#ff5c00]" />
                رزم جاهزة ({offer.packages.length})
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                اضغط رزمة لإضافة محتواها مباشرة، ثم عدّل الكميات إن أردت.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {offer.packages.map((pkg) => {
                  const totalPieces = pkg.items.reduce((s, i) => s + i.quantity, 0);
                  const summary = pkg.items
                    .map((i) => {
                      const v = offer.variants.find((x) => x.id === i.variantId);
                      return `${i.quantity}× ${fmtAttrs(v?.attributes)}`;
                    })
                    .join(" · ");
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => applyPackage(pkg)}
                      className="rounded-lg border-2 border-gray-200 bg-white p-3 text-right transition hover:border-[#ff5c00] hover:bg-orange-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900">{pkg.name}</span>
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-[#ff5c00]">
                          {totalPieces}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-gray-600">{summary}</p>
                    </button>
                  );
                })}
              </div>
              {packageFeedback && (
                <div className="mt-3 rounded-lg bg-green-50 p-2 text-xs text-green-800">
                  {packageFeedback}
                </div>
              )}
            </Card>
          )}

          {offer.autoBalanceEnabled && (
            <Card>
              <div id="auto-balance-panel" className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  التوزيع التلقائي
                </h3>
                <p className="text-xs text-gray-500">
                  أدخل الكمية الإجمالية — النظام يوزّعها على الألوان المتوفرة بنسب ذكية. الألوان النادرة تُضاف يدوياً فقط.
                </p>

                {offer.requireSizeSelection && availableSizes.length > 0 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      اختر المقاس أولاً ({selectedSizes.size} محدد)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleSize(s)}
                          className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                            selectedSizes.has(s)
                              ? "border-purple-500 bg-purple-500 text-white"
                              : "border-gray-200 bg-white text-gray-700 hover:border-purple-300"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {selectedSizes.size === 0 && (
                      <p className="mt-1 text-[11px] text-amber-700">اختر مقاساً واحداً على الأقل لبدء التوزيع</p>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    الكمية الإجمالية المطلوبة
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={offer.minOrderQty}
                      max={offer.maxOrderQty ?? undefined}
                      value={autoBalanceTotal}
                      onChange={(e) => setAutoBalanceTotal(e.target.value)}
                      placeholder={`مثال: ${offer.minOrderQty * 5}`}
                      className="h-10 flex-1 rounded-lg border-2 border-gray-200 px-3 text-sm font-bold focus:border-purple-500 focus:outline-none"
                    />
                    {autoBalanceLoading && (
                      <span className="text-xs text-gray-500">يحسب...</span>
                    )}
                  </div>
                </div>

                {autoBalanceError && (
                  <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
                    {autoBalanceError}
                  </div>
                )}

                {minDistributed > 0 && (
                  <div className="rounded-lg bg-purple-50 p-2 text-xs text-purple-800">
                    <p>
                      الحد الأدنى المُوزَّع: <strong>{minDistributed}</strong> قطعة
                    </p>
                    <p className="mt-1 text-purple-600">
                      الألوان النادرة محدودة بـ {minDistributed} قطعة كحد أقصى
                    </p>
                  </div>
                )}

                {Object.keys(rareCaps).length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    <p className="font-bold">ألوان نادرة (تُضاف يدوياً):</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {offer.variants
                        .filter((v) => rareCaps[v.id] !== undefined)
                        .map((v) => (
                          <li key={v.id}>
                            {fmtAttrs(v.attributes)} — حد أقصى {rareCaps[v.id]}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Layers className="h-4 w-4 text-gray-400" />
                الخيارات ({offer.variants.length})
              </h3>
              {totalQty > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-gray-500 underline hover:text-red-600"
                >
                  مسح الكل
                </button>
              )}
            </div>
            <p className="mb-3 text-xs text-gray-500">
              المجموع ≥ <strong>{offer.minOrderQty}</strong>
              {offer.maxOrderQty !== null && ` و≤ ${offer.maxOrderQty}`}.
            </p>

            <div className="space-y-2">
              {offer.variants.map((v) => {
                const qty = quantities[v.id] || 0;
                const max = v.availableStock ?? 0;
                const price = variantPrices.get(v.id);
                const hints = bundleHints.get(v.id);
                const isActive = qty > 0;
                const isMaxed = qty >= max;
                const isTrigger = (offer.bundleRules || []).some(
                  (r) => r.triggerVariantId === v.id
                );
                const isBlocked = blockedVariants.has(v.id);

                return (
                  <div
                    key={v.id}
                    className={`rounded-lg border-2 p-3 transition-colors ${
                      isBlocked
                        ? "border-gray-100 bg-gray-50 opacity-60"
                        : isActive
                        ? "border-[#ff5c00] bg-orange-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {v.attributes.length === 0 ? (
                            <span className="text-xs text-gray-500">افتراضي</span>
                          ) : (
                            v.attributes.map((a, i) => (
                              <span
                                key={i}
                                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                              >
                                {a.name}: <strong>{a.value}</strong>
                              </span>
                            ))
                          )}
                          {isTrigger && (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              <Link2 className="h-2.5 w-2.5" /> مرتبط
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-gray-500">
                          {v.tiers.length > 0 ? (
                            v.tiers.length === 1 ? (
                              <span>{formatMoney(v.tiers[0].unitPrice)} د.م</span>
                            ) : (
                              <span>
                                {v.tiers.map((t, i) => (
                                  <span key={i}>
                                    {i > 0 && " · "}
                                    {t.minQty}
                                    {t.maxQty !== null ? `-${t.maxQty}` : "+"}:{" "}
                                    {formatMoney(t.unitPrice)}
                                  </span>
                                ))}
                              </span>
                            )
                          ) : (
                            <span className="text-red-600">لا شرائح سعر</span>
                          )}
                          <span>
                            · مخزون:{" "}
                            <strong className={max === 0 ? "text-red-600" : "text-gray-900"}>
                              {max}
                            </strong>
                          </span>
                        </div>
                        {hints && hints.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {hints.map((h, i) => (
                              <p key={i} className="text-[11px] text-amber-700">
                                ⚠ {h}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => decrement(v.id)}
                          disabled={qty <= 0}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                          aria-label="إنقاص"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={qty === 0 ? "" : String(qty)}
                          onChange={(e) => setDirect(v.id, e.target.value)}
                          placeholder="0"
                          disabled={isBlocked}
                          className="h-9 w-14 rounded-lg border-2 border-gray-200 text-center text-sm font-bold focus:border-[#ff5c00] focus:outline-none disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => increment(v.id)}
                          disabled={isMaxed || isBlocked}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                          aria-label="زيادة"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {price !== undefined && qty > 0 && (
                      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-1 text-xs">
                        <span className="text-gray-600">
                          {qty} × {formatMoney(price)} د.م
                        </span>
                        <span className="font-bold text-[#ff5c00]">
                          {formatMoney(price * qty)} د.م
                        </span>
                      </div>
                    )}
                    {isBlocked && (
                      <p className="mt-1 text-[11px] text-gray-600">خارج المقاسات المختارة</p>
                    )}
                    {!isBlocked && isMaxed && max > 0 && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        الحد الأقصى المتاح {max} قطعة
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">البائع</h3>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                <Building2 className="h-4 w-4 text-gray-400" />
                {offer.sellerName}
              </p>
              <p className="text-xs text-gray-500">
                {BU_TYPE_LABEL[offer.sellerType] ?? offer.sellerType}
              </p>
              {offer.sellerVerificationStatus === "VERIFIED" && (
                <Badge variant="green" size="sm">
                  <ShieldCheck className="h-3 w-3" /> نشاط موثق
                </Badge>
              )}
              <p className="text-xs text-gray-500">
                عضو منذ {formatDate(offer.createdAt)}
              </p>
            </div>
          </Card>

          <div className="lg:sticky lg:top-4">
            <Card>
              <h3 className="mb-3 text-sm font-bold text-gray-900">ملخص الطلب</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">خيارات مختارة</span>
                  <span className="font-medium">{selectedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">إجمالي القطع</span>
                  <span className={`font-bold ${minMet ? "text-gray-900" : "text-red-600"}`}>
                    {totalQty}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">الحد الأدنى</span>
                  <span className="text-gray-700">{offer.minOrderQty}</span>
                </div>
                {offer.maxOrderQty !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">الحد الأقصى</span>
                    <span className={maxExceeded ? "font-bold text-red-600" : "text-gray-700"}>
                      {offer.maxOrderQty}
                    </span>
                  </div>
                )}
                {totalEstimate > 0 && (
                  <div className="flex justify-between border-t pt-2 text-base">
                    <span className="font-bold">الإجمالي</span>
                    <span className="font-black text-[#ff5c00]">
                      {formatMoney(totalEstimate)} د.م
                    </span>
                  </div>
                )}
              </div>

              {!minMet && totalQty > 0 && (
                <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  يتبقى {offer.minOrderQty - totalQty} قطعة
                </div>
              )}
              {maxExceeded && (
                <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  تجاوزت الحد الأقصى بـ {totalQty - (offer.maxOrderQty || 0)}
                </div>
              )}
              {bundleViolations.length > 0 && (
                <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
                  {bundleViolations.map((v, i) => (
                    <p key={i} className="flex items-start gap-1 text-xs text-amber-800">
                      <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" /> {v}
                    </p>
                  ))}
                </div>
              )}
              {canOrder && (
                <div className="mt-3 flex items-center gap-1 rounded-lg bg-green-50 p-2 text-xs text-green-700">
                  <CheckCircle2 className="h-3 w-3" /> جاهز للإرسال
                </div>
              )}

              <div className="mt-3">
                <Button
                  fullWidth
                  disabled={!canOrder}
                  variant="primary"
                  iconLeft={<ShoppingCart className="h-4 w-4" />}
                  onClick={handleAddToCart}
                >
                  أضف إلى السلة ({totalQty})
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Bundle Prompt Modal (M9.5c) */}
      {bundlePrompt && !offer.autoBalanceEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={cancelBundlePrompt}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Link2 className="h-5 w-5 text-amber-500" />
                شرط شراء مرتبط
              </h3>
              <button onClick={cancelBundlePrompt} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-sm text-gray-700">
              شراء <strong className="text-[#ff5c00]">{bundlePrompt.triggerLabel}</strong>{" "}
              (سيتحول إلى {bundlePrompt.newTriggerQty}) يتطلب إضافة:
            </p>

            <div className="mb-4 space-y-2">
              {bundlePrompt.rows.map((row) => (
                <div
                  key={row.variantId}
                  className={`rounded-lg border p-2 text-sm ${
                    row.wouldExceed
                      ? "border-red-300 bg-red-50"
                      : row.delta > 0
                      ? "border-amber-200 bg-amber-50"
                      : "border-green-200 bg-green-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 font-medium text-gray-900">{row.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        row.wouldExceed
                          ? "bg-red-200 text-red-800"
                          : row.delta > 0
                          ? "bg-amber-200 text-amber-800"
                          : "bg-green-200 text-green-800"
                      }`}
                    >
                      {row.wouldExceed
                        ? `⚠ يحتاج ${row.current + row.delta} / متاح ${row.stock}`
                        : row.delta > 0
                        ? `+${row.delta}`
                        : `✓ لديك ${row.current}`}
                    </span>
                  </div>
                  {row.wouldExceed && (
                    <p className="mt-1 text-xs text-red-700">
                      المخزون غير كافٍ — قلل من {bundlePrompt.triggerLabel} أو أزل هذا الخيار
                    </p>
                  )}
                  {!row.wouldExceed && row.delta > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      المطلوب: {row.needed} — لديك: {row.current}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {hasBlockingRow && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                لا يمكن المتابعة — المخزون غير كافٍ لبعض الخيارات.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={cancelBundlePrompt}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={confirmBundlePrompt}
                disabled={hasBlockingRow}
                className="flex-1 rounded-lg bg-[#ff5c00] px-3 py-2 text-sm font-bold text-white hover:bg-[#e64a00] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                موافق — أضف الكل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}