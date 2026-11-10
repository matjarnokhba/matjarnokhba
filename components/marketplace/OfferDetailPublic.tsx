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

function getSizeFromAttrs(
  attrs?: Array<{ name: string; value: string }>
): string | null {
  if (!attrs) return null;
  for (const a of attrs) {
    const n = a.name.toLowerCase().trim();
    if (n.includes("مقاس") || n.includes("size")) return a.value || null;
  }
  return null;
}

export interface OfferDetailPublicProps {
  offer: PublicOfferDetail;
  buyerBUs: BuyerBU[];
  isOwnOffer: boolean;
}

type VariantDist = {
  variantId: number;
  attributes: Array<{ name: string; value: string }>;
  sizeValue: string | null;
  stock: number;
  isRare: boolean;
  isBlocked: boolean;
  baseQty: number;
  suggestedQty: number;
  minAllowed: number;
  maxAllowed: number;
  maxAdjust: number;
};

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
  const router = useRouter();
  const { toast } = useToast();
  const { addItem } = useWholesaleCart();

  // ============ Manual mode state (non-auto-balance) ============
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [packageFeedback, setPackageFeedback] = useState("");
  const [bundlePrompt, setBundlePrompt] = useState<BundlePrompt | null>(null);

  // ============ Auto-balance state ============
  const [selectedSizes, setSelectedSizes] = useState<Set<string>>(new Set());
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
  const [distributions, setDistributions] = useState<Map<number, VariantDist>>(new Map());
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState("");
  const [manualAdjust, setManualAdjust] = useState<Record<number, number>>({});
  const [pendingPackage, setPendingPackage] = useState<{ name: string; items: Array<{ variantId: number; quantity: number }> } | null>(null);
  const [pkgBoosted, setPkgBoosted] = useState<Set<number>>(new Set());
  const [pkgBase, setPkgBase] = useState<Record<number, number>>({});
  const [sizeLimits, setSizeLimits] = useState<Record<string, number>>({});

  const availableSizes = useMemo(() => {
    const set = new Set<string>();
    for (const v of offer.variants) {
      const s = getSizeFromAttrs(v.attributes);
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [offer.variants]);

  const hasSizes = availableSizes.length > 0;

  const sizeLimitsMap = useMemo(
    () => offer.sizeLimits ?? {},
    [offer.sizeLimits]
  );

  const maxSizeQty = useCallback((size: string): number => {
    let sum = 0;
    for (const v of offer.variants) {
      if (getSizeFromAttrs(v.attributes) === size) {
        sum += v.availableStock ?? 0;
      }
    }
    return sum;
  }, [offer.variants]);

  const sizeErrors = useMemo(() => {
    const errs: Record<string, string | null> = {};
    for (const s of selectedSizes) {
      const raw = sizeQuantities[s];
      const qty = raw ? parseInt(raw, 10) : 0;
      const limit = sizeLimitsMap[s] || 0;
      const maxQ = maxSizeQty(s);
      // M10.9f: if all variants in this size are pkgBoosted, skip limit checks
      const sizeVariantIds = offer.variants
        .filter((v) => getSizeFromAttrs(v.attributes) === s)
        .map((v) => v.id);
      const anyBoosted = sizeVariantIds.some((id) => pkgBoosted.has(id));
      if (anyBoosted) {
        errs[s] = null;
        continue;
      }
      if (!qty || qty < 1) {
        errs[s] = "الكمية مطلوبة";
      } else if (qty < limit) {
        errs[s] = "أقل من الحد الأدنى (" + limit + ")";
      } else if (maxQ > 0 && qty > maxQ) {
        errs[s] = "أكثر من المخزون المتاح (" + maxQ + ")";
      } else {
        errs[s] = null;
      }
    }
    return errs;
  }, [selectedSizes, sizeQuantities, sizeLimitsMap, maxSizeQty, pkgBoosted, offer.variants]);

  // Group variants by size (for display)
  const variantsBySize = useMemo(() => {
    const map = new Map<string, Array<{ id: number; attributes: Array<{ name: string; value: string }>; availableStock: number }>>();
    if (!hasSizes) {
      map.set("*", offer.variants.map((v) => ({
        id: v.id,
        attributes: v.attributes,
        availableStock: v.availableStock ?? 0,
      })));
      return map;
    }
    for (const v of offer.variants) {
      const s = getSizeFromAttrs(v.attributes);
      if (!s) continue;
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push({
        id: v.id,
        attributes: v.attributes,
        availableStock: v.availableStock ?? 0,
      });
    }
    return map;
  }, [offer.variants, hasSizes]);

  // ============ Compute effective quantity per variant ============
  const effectiveQty = useCallback(
    (variantId: number): number => {
      if (offer.autoBalanceEnabled) {
        const dist = distributions.get(variantId);
        if (!dist) return 0;
        if (dist.isBlocked) return 0;
        return manualAdjust[variantId] ?? dist.suggestedQty;
      }
      return quantities[variantId] || 0;
    },
    [offer.autoBalanceEnabled, distributions, manualAdjust, quantities]
  );

  const totalQty = useMemo(() => {
    if (offer.autoBalanceEnabled) {
      let sum = 0;
      for (const dist of distributions.values()) {
        if (dist.isBlocked) continue;
        sum += manualAdjust[dist.variantId] ?? dist.suggestedQty;
      }
      return sum;
    }
    let sum = 0;
    for (const v of offer.variants) sum += quantities[v.id] || 0;
    return sum;
  }, [offer.autoBalanceEnabled, distributions, manualAdjust, quantities, offer.variants]);

  const variantPrices = useMemo(() => {
    const map = new Map<number, number>();
    for (const v of offer.variants) {
      const qty = effectiveQty(v.id);
      if (qty <= 0) continue;
      let tier = v.tiers.find(
        (t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)
      );
      if (!tier && v.tiers.length > 0) tier = v.tiers[0];
      if (tier) map.set(v.id, tier.unitPrice);
    }
    return map;
  }, [effectiveQty, offer.variants]);

  const totalEstimate = useMemo(() => {
    let total = 0;
    for (const v of offer.variants) {
      const p = variantPrices.get(v.id);
      if (p === undefined) continue;
      total += p * effectiveQty(v.id);
    }
    return Math.round(total * 100) / 100;
  }, [variantPrices, effectiveQty, offer.variants]);

  // ============ Bundle rules (manual mode) ============
  const bundleViolations = useMemo(() => {
    if (offer.autoBalanceEnabled) return [];
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
          `شراء "${fmtAttrs(tv?.attributes)}" يستلزم ${neededQty} على الأقل من "${fmtAttrs(rv?.attributes)}" — لديك: ${requiredQty}`
        );
      }
    }
    return violations;
  }, [quantities, offer.bundleRules, offer.variants, offer.autoBalanceEnabled]);

  const minMet = totalQty === 0 || totalQty >= offer.minOrderQty;
  const maxExceeded = offer.maxOrderQty !== null && totalQty > offer.maxOrderQty;

  const canOrder = useMemo(() => {
    if (isOwnOffer || buyerBUs.length === 0 || totalQty === 0) return false;
    if (!minMet || maxExceeded) return false;

    if (offer.autoBalanceEnabled) {
      // In auto-balance: all quantities already within [minAllowed, maxAllowed]
      return true;
    }

    return bundleViolations.length === 0;
  }, [isOwnOffer, buyerBUs, totalQty, minMet, maxExceeded, offer.autoBalanceEnabled, bundleViolations]);

  // ============ Auto-balance fetch ============
  useEffect(() => {
    if (!offer.autoBalanceEnabled) return;

    const sizesToCompute = Array.from(selectedSizes);
    if (sizesToCompute.length === 0) {
      setDistributions((prev) => (prev.size === 0 ? prev : new Map()));
      setManualAdjust((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setPkgBoosted((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    // M10.9i: exclude pkgBoosted sizes from fetch (their qty is manual, not size-limited)
    const pkgBoostedSizes = new Set<string>();
    for (const v of offer.variants) {
      if (pkgBoosted.has(v.id)) {
        const sv = getSizeFromAttrs(v.attributes);
        if (sv) pkgBoostedSizes.add(sv);
      }
    }
    const sizesForFetch = sizesToCompute.filter((sz) => !pkgBoostedSizes.has(sz));

    // Build synthetic dists for pkgBoosted variants of selected sizes
    const buildSynthMap = (): Map<number, VariantDist> => {
      const m = new Map<number, VariantDist>();
      const maxAdj = offer.maxManualAdjustment ?? 1;
      for (const ov of offer.variants) {
        if (!pkgBoosted.has(ov.id)) continue;
        const sizeVal = getSizeFromAttrs(ov.attributes);
        if (!sizeVal || !sizesToCompute.includes(sizeVal)) continue;
        const stock = ov.availableStock ?? 0;
        const base = pkgBase[ov.id] ?? 0;
        const minAllowed = Math.max(0, base - maxAdj);
        const maxAllowed = Math.min(stock, base + maxAdj);
        m.set(ov.id, {
          variantId: ov.id,
          attributes: ov.attributes,
          sizeValue: sizeVal,
          stock,
          isRare: false,
          isBlocked: false,
          baseQty: base,
          suggestedQty: base,
          minAllowed,
          maxAllowed,
          maxAdjust: maxAdj,
        });
      }
      return m;
    };

    // If ALL selected sizes are pkgBoosted → skip fetch, just render synthetics
    if (sizesForFetch.length === 0) {
      const synth = buildSynthMap();
      setDistributions((prev) => {
        if (prev.size === synth.size) {
          let same = true;
          for (const k of synth.keys()) if (!prev.has(k)) { same = false; break; }
          if (same) return prev;
        }
        return synth;
      });
      return;
    }
    // Block compute if any size has invalid qty, UNLESS it has a pkgBoosted variant
    const hasInvalidSize = sizesForFetch.some((s) => {
      const raw = sizeQuantities[s];
      const q = raw ? parseInt(raw, 10) : 0;
      const limit = sizeLimitsMap[s] || 0;
      const maxQ = maxSizeQty(s);
      return q < 1 || q < limit || (maxQ > 0 && q > maxQ);
    });
    if (hasInvalidSize) {
      setDistributions((prev) => (prev.size === 0 ? prev : new Map()));
      setManualAdjust((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setPkgBoosted((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }

    // If requireSizeSelection is on, ensure all selected sizes have a quantity
    const effective: Array<{ size: string; qty: number }> = [];
    for (const s of sizesToCompute) {
      const qty = parseInt(sizeQuantities[s] || "0", 10);
      if (qty > 0) effective.push({ size: s, qty });
    }
    if (effective.length === 0) {
      setDistributions(new Map());
      setManualAdjust({});
      return;
    }

    const timer = setTimeout(async () => {
      setAutoLoading(true);
      setAutoError("");
      try {
        const effective: Array<{ size: string; qty: number }> = [];
        for (const sz of sizesForFetch) {
          const qty = parseInt(sizeQuantities[sz] || "0", 10);
          if (qty > 0) effective.push({ size: sz, qty });
        }
        if (effective.length === 0) {
          setAutoLoading(false);
          return;
        }
        const sizesParam = encodeURIComponent(
          effective.map((e) => `${e.size}:${e.qty}`).join(",")
        );
        const res = await fetch(
          `/api/wholesale/offers/${offer.id}/auto-balance/compute?sizes=${sizesParam}`
        );
        const d = await res.json();
        if (!d.success) {
          setAutoError(d.message || "فشل التوزيع");
          return;
        }
        const nextMap = new Map<number, VariantDist>();
        for (const v of d.variants as VariantDist[]) {
          nextMap.set(v.variantId, v);
        }
        // Merge pkgBoosted synthetics
        const synth = buildSynthMap();
        for (const [k, v] of synth) {
          if (!nextMap.has(k)) nextMap.set(k, v);
        }
        setDistributions(nextMap);
        setManualAdjust((prev) => {
          const next: Record<number, number> = { ...prev };
          for (const v of d.variants as VariantDist[]) {
            if (!(v.variantId in next) && !v.isBlocked) {
              next[v.variantId] = v.suggestedQty;
            }
          }
          return next;
        });
        if (d.sizeLimits) setSizeLimits(d.sizeLimits as Record<string, number>);
      } catch {
        setAutoError("خطأ في الاتصال");
      } finally {
        setAutoLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [offer.autoBalanceEnabled, offer.id, selectedSizes, sizeQuantities, sizeLimitsMap, maxSizeQty, offer.variants, pkgBoosted, pkgBase, offer.maxManualAdjustment]);
  // M10.9e: apply pending package once distributions are ready
  // ============ Handlers ============
  function toggleSize(size: string) {
    setSelectedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(size)) {
        next.delete(size);
        setSizeQuantities((sq) => {
          const copy = { ...sq };
          delete copy[size];
          return copy;
        });
      } else {
        next.add(size);
        const limit = sizeLimitsMap[size] || 0;
        const initial = Math.max(limit, offer.minOrderQty);
        setSizeQuantities((sq) => ({ ...sq, [size]: String(initial) }));
      }
      return next;
    });
    setDistributions(new Map());
    setManualAdjust({});
    setPkgBoosted((prev) => {
      const next = new Set(prev);
      for (const v of offer.variants) {
        if (getSizeFromAttrs(v.attributes) === size) next.delete(v.id);
      }
      return next;
    });
    setPkgBase((prev) => {
      const next = { ...prev };
      for (const v of offer.variants) {
        if (getSizeFromAttrs(v.attributes) === size) delete next[v.id];
      }
      return next;
    });
  }

  function setSizeQty(size: string, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setSizeQuantities((prev) => {
      const next = { ...prev };
      if (raw === "" || raw === "0") delete next[size];
      else next[size] = raw;
      return next;
    });
    // Clear pkgBoosted only for variants in THIS size
    setPkgBoosted((prev) => {
      const next = new Set(prev);
      for (const v of offer.variants) {
        if (getSizeFromAttrs(v.attributes) === size) next.delete(v.id);
      }
      return next;
    });
    setPkgBase((prev) => {
      const next = { ...prev };
      for (const v of offer.variants) {
        if (getSizeFromAttrs(v.attributes) === size) delete next[v.id];
      }
      return next;
    });
  }

  function adjustVariant(variantId: number, delta: number) {
    const dist = distributions.get(variantId);
    if (!dist || dist.isBlocked) return;
    const cur = manualAdjust[variantId] ?? dist.suggestedQty;
    const next = cur + delta;
    if (next < dist.minAllowed || next > dist.maxAllowed) return;
    setManualAdjust((prev) => ({ ...prev, [variantId]: next }));
  }

  function setVariantDirect(variantId: number, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    const dist = distributions.get(variantId);
    if (!dist || dist.isBlocked) return;
    let n = raw === "" ? 0 : parseInt(raw, 10);
    n = Math.max(dist.minAllowed, Math.min(dist.maxAllowed, n));
    setManualAdjust((prev) => ({ ...prev, [variantId]: n }));
  }

  // ============ Manual mode handlers ============
  function maxForManual(variantId: number): number {
    const v = offer.variants.find((x) => x.id === variantId);
    return v?.availableStock ?? 0;
  }

  function incrementManual(variantId: number) {
    const max = maxForManual(variantId);
    const cur = quantities[variantId] || 0;
    if (cur >= max) return;

    if (!offer.autoBalanceEnabled && (offer.bundleRules || []).some((r) => r.triggerVariantId === variantId)) {
      const rules = (offer.bundleRules || []).filter((r) => r.triggerVariantId === variantId);
      const rows: BundlePromptRow[] = [];
      let anyDelta = false;
      const newTriggerQty = cur + 1;
      for (const rule of rules) {
        const current = quantities[rule.requiredVariantId] || 0;
        const needed = rule.isMultiplied ? newTriggerQty * rule.minQuantity : rule.minQuantity;
        const delta = Math.max(0, needed - current);
        const rv = offer.variants.find((v) => v.id === rule.requiredVariantId);
        const stock = rv?.availableStock ?? 0;
        if (delta > 0) anyDelta = true;
        rows.push({
          variantId: rule.requiredVariantId,
          label: fmtAttrs(rv?.attributes),
          needed,
          current,
          delta,
          stock,
          wouldExceed: current + delta > stock,
        });
      }
      if (anyDelta) {
        setBundlePrompt({ triggerVariantId: variantId, triggerLabel: fmtAttrs(offer.variants.find((v) => v.id === variantId)?.attributes), newTriggerQty, rows });
        return;
      }
    }

    setQuantities((p) => ({ ...p, [variantId]: cur + 1 }));
    setPackageFeedback("");
  }

  function decrementManual(variantId: number) {
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

  function setDirectManual(variantId: number, raw: string) {
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    const max = maxForManual(variantId);
    let n = raw === "" ? 0 : parseInt(raw, 10);
    if (n > max) n = max;
    setQuantities((p) => {
      const next = { ...p };
      if (n === 0) delete next[variantId];
      else next[variantId] = n;
      return next;
    });
    setPackageFeedback("");
  }

  function confirmBundlePrompt() {
    if (!bundlePrompt) return;
    const next = { ...quantities };
    next[bundlePrompt.triggerVariantId] = bundlePrompt.newTriggerQty;
    for (const row of bundlePrompt.rows) {
      if (row.delta > 0) next[row.variantId] = row.current + row.delta;
    }
    setQuantities(next);
    setBundlePrompt(null);
  }

  function clearAll() {
    setQuantities({});
    setSelectedSizes(new Set());
    setSizeQuantities({});
    setDistributions(new Map());
    setManualAdjust({});
    setPackageFeedback("");
  }

  function applyPackage(pkg: { name: string; items: Array<{ variantId: number; quantity: number }> }) {
    if (offer.autoBalanceEnabled) {
      const pkgSizes = new Set<string>();
      const qtyPerSize: Record<string, number> = {};
      for (const item of pkg.items) {
        const v = offer.variants.find((x) => x.id === item.variantId);
        if (!v) continue;
        const size = getSizeFromAttrs(v.attributes);
        if (size) {
          pkgSizes.add(size);
          qtyPerSize[size] = (qtyPerSize[size] || 0) + item.quantity;
        }
      }

      const next = { ...manualAdjust };
      const nextBoosted = new Set(pkgBoosted);
      const nextBase = { ...pkgBase };
      let capped = false;

      for (const item of pkg.items) {
        const dist = distributions.get(item.variantId);
        const stock = dist ? dist.stock : (offer.variants.find((x) => x.id === item.variantId)?.availableStock ?? 0);
        if (stock <= 0) continue;
        const prevBase = nextBase[item.variantId] ?? 0;
        const newBase = Math.min(prevBase + item.quantity, stock);
        if (newBase < prevBase + item.quantity) capped = true;
        nextBase[item.variantId] = newBase;
        next[item.variantId] = newBase;
        nextBoosted.add(item.variantId);
      }

      const nextSelected = new Set(selectedSizes);
      const nextSizeQty = { ...sizeQuantities };
      for (const s of pkgSizes) {
        nextSelected.add(s);
        const current = parseInt(nextSizeQty[s] || "0", 10) || 0;
        nextSizeQty[s] = String(Math.max(current, qtyPerSize[s] || 0));
      }

      setSelectedSizes(nextSelected);
      setSizeQuantities(nextSizeQty);
      setManualAdjust(next);
      setPkgBoosted(nextBoosted);
      setPkgBase(nextBase);
      setPackageFeedback(
        capped ? `أضيفت "${pkg.name}" — وصلت لحد المخزون` : `أضيفت "${pkg.name}"`
      );
      setTimeout(() => setPackageFeedback(""), 4000);
      return;
    }

    const nextQty = { ...quantities };
    let cappedM = false;
    for (const item of pkg.items) {
      const max = maxForManual(item.variantId);
      const cur = nextQty[item.variantId] || 0;
      const want = cur + item.quantity;
      if (want > max) { nextQty[item.variantId] = max; cappedM = true; }
      else { nextQty[item.variantId] = want; }
    }
    setQuantities(nextQty);
    setPackageFeedback(
      cappedM ? `أضيفت "${pkg.name}" — بعض الخيارات تجاوزت المخزون` : `أضيفت "${pkg.name}"`
    );
    setTimeout(() => setPackageFeedback(""), 4000);
  }


  function handleAddToCart() {
    if (!canOrder) return;
    let added = 0;
    for (const v of offer.variants) {
      const qty = effectiveQty(v.id);
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

  const selectedCount = offer.autoBalanceEnabled
    ? Array.from(distributions.values()).filter((d) => !d.isBlocked && (manualAdjust[d.variantId] ?? d.suggestedQty) > 0).length
    : Object.values(quantities).filter((q) => q > 0).length;

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
          {/* Images */}
          <Card>
            <div className="mb-3 flex aspect-square max-h-[400px] items-center justify-center overflow-hidden rounded-lg bg-gray-50">
              {offer.master.images[activeImage] ? (
                <img src={offer.master.images[activeImage]} alt={offer.master.name} className="h-full w-full object-contain" />
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

          {/* Description */}
          {offer.master.description && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">الوصف</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{offer.master.description}</p>
            </Card>
          )}

          {/* Packages (manual mode only) */}
          {offer.packages && offer.packages.length > 0 && (
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Boxes className="h-4 w-4 text-[#ff5c00]" />
                حزم جاهزة ({offer.packages.length})
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {offer.packages.map((pkg) => {
                  const totalPieces = pkg.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => applyPackage(pkg)}

                      className="rounded-lg border-2 border-gray-200 bg-white p-3 text-right transition hover:border-[#ff5c00] hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-bold text-gray-900">{pkg.name}</span>
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-[#ff5c00]">{totalPieces}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] text-gray-600">
                        {pkg.items.map((i) => {
                          const v = offer.variants.find((x) => x.id === i.variantId);
                          return `${i.quantity}× ${fmtAttrs(v?.attributes)}`;
                        }).join(" · ")}
                      </p>
                    </button>
                  );
                })}
              </div>
              {packageFeedback && (
                <div className="mt-3 rounded-lg bg-green-50 p-2 text-xs text-green-800">{packageFeedback}</div>
              )}
            </Card>
          )}

          {/* AUTO-BALANCE PANEL */}
          {offer.autoBalanceEnabled && (
            <Card>
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  التوزيع التلقائي
                </h3>
                <p className="text-xs text-gray-500">
                  اختر المقاسات وأدخل الكمية لكل مقاس. النظام يوزّعها على الألوان المتوفرة تلقائياً.
                  يمكنك تعديل كل لون بمقدار محدود.
                </p>

                {/* Size picker */}
                {hasSizes && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      المقاسات المتاحة
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableSizes.map((s) => {
                        const limit = sizeLimitsMap[s] || 0;
                        const isSelected = selectedSizes.has(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSize(s)}
                            className={`rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition ${
                              isSelected
                                ? "border-purple-500 bg-purple-500 text-gray-600"
                                : "border-gray-200 bg-white text-gray-700 hover:border-purple-300"
                            }`}
                          >
                            {s}
                            {limit > 1 && (
                              <span className="ml-1 text-[10px] opacity-80">
                                (≥{limit})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Per-size qty inputs */}
                {selectedSizes.size > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                      الكمية لكل مقاس
                    </label>
                    {Array.from(selectedSizes).sort().map((s) => {
                      const err = sizeErrors[s];
                      const limit = sizeLimitsMap[s] || 0;
                      return (
                        <div key={s} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                            <span className="w-12 text-center text-sm font-bold text-gray-900">{s}</span>
                            <input
                              type="number"
                              min="1"
                              value={sizeQuantities[s] || ""}
                              onChange={(e) => setSizeQty(s, e.target.value)}
                              placeholder="0"
                              className={`h-9 flex-1 rounded-lg border-2 px-3 text-sm font-bold focus:outline-none ${
                                err
                                  ? "border-red-400 bg-red-50 focus:border-red-500"
                                  : "border-gray-200 focus:border-purple-500"
                              }`}
                            />
                            {limit > 0 && (
                              <span className="text-[10px] text-gray-500">
                                ≥{limit}
                              </span>
                            )}
                            {autoLoading && <span className="text-xs text-gray-500">...</span>}
                          </div>
                          {err && (
                            <p className="text-[11px] text-red-600 px-14">{err}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {autoError && (
                  <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{autoError}</div>
                )}

                {selectedSizes.size === 0 && hasSizes && (
                  <p className="text-xs text-amber-700">اختر مقاساً واحداً على الأقل</p>
                )}
              </div>
            </Card>
          )}

          {/* VARIANTS — auto mode: grouped by size + steppers */}
          {offer.autoBalanceEnabled && selectedSizes.size > 0 && distributions.size > 0 && (
            <Card>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Layers className="h-4 w-4 text-gray-400" />
                التوزيع ({Array.from(distributions.values()).filter((d) => !d.isBlocked && (manualAdjust[d.variantId] ?? d.suggestedQty) > 0).length} خيار)
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                اضبط كل لون ضمن حدوده ({offer.autoBalanceEnabled ? "يمكن زيادة أو إنقاص بمقدار محدود" : ""}). لتغيير أكبر، عدّل كمية المقاس أعلاه.
              </p>

              <div className="space-y-4">
                {Array.from(selectedSizes).sort().map((size) => {
                  const sizeVariants = offer.variants
                    .filter((v) => getSizeFromAttrs(v.attributes) === size)
                    .map((v) => distributions.get(v.id))
                    .filter((d): d is VariantDist => !!d && !d.isBlocked);

                  if (sizeVariants.length === 0) return null;

                  return (
                    <div key={size} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="rounded bg-purple-500 px-2 py-0.5 text-xs font-bold text-gray-600">
                          مقاس {size}
                        </span>
                        <span className="text-xs text-gray-600">
                          {sizeQuantities[size] || "0"} قطعة
                        </span>
                      </div>
                      <div className="space-y-2">
                        {sizeVariants.map((dist) => {
                          const v = offer.variants.find((x) => x.id === dist.variantId);
                          if (!v) return null;
                          const qty = manualAdjust[dist.variantId] ?? dist.suggestedQty;
                          const canDec = qty > dist.minAllowed;
                          const canInc = qty < dist.maxAllowed;
                          const price = variantPrices.get(dist.variantId);
                          const attrsWithoutSize = (v.attributes || []).filter(
                            (a) => !a.name.toLowerCase().includes("مقاس") && !a.name.toLowerCase().includes("size")
                          );

                          return (
                            <div key={dist.variantId} className="rounded-lg bg-white p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1">
                                    {attrsWithoutSize.length === 0 ? (
                                      <span className="text-xs text-gray-500">افتراضي</span>
                                    ) : (
                                      attrsWithoutSize.map((a, i) => (
                                        <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                                          {a.name}: <strong>{a.value}</strong>
                                        </span>
                                      ))
                                    )}
                                    {dist.isRare && (
                                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                                        نادر
                                      </span>
                                    )}                                    {pkgBoosted.has(dist.variantId) && (
                                      <span className="rounded inline-flex items-center gap-1 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">
                                        من حزمة
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                                    <span>مخزون: {dist.stock}</span>
                                    {dist.isRare ? (
                                      <span>· حد أقصى: {dist.maxAllowed}</span>
                                    ) : (
                                      <span>· الحد: {dist.minAllowed}–{dist.maxAllowed}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => adjustVariant(dist.variantId, -1)}
                                    disabled={!canDec}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-gray-600 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                    aria-label="إنقاص"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={qty === 0 ? "" : String(qty)}
                                    onChange={(e) => setVariantDirect(dist.variantId, e.target.value)}
                                    className="h-9 w-14 rounded-lg border-2 border-gray-200 text-center text-sm font-bold focus:border-purple-500 focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => adjustVariant(dist.variantId, 1)}
                                    disabled={!canInc}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-gray-600 transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                    aria-label="زيادة"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              {price !== undefined && qty > 0 && (
                                <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 text-[11px]">
                                  <span className="text-gray-600">{qty} × {formatMoney(price)} د.م</span>
                                  <span className="font-bold text-[#ff5c00]">{formatMoney(price * qty)} د.م</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* VARIANTS — manual mode */}
          {!offer.autoBalanceEnabled && (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                  <Layers className="h-4 w-4 text-gray-400" />
                  الخيارات ({offer.variants.length})
                </h3>
                {totalQty > 0 && (
                  <button type="button" onClick={clearAll} className="text-xs text-gray-500 underline hover:text-red-600">
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
                  const isActive = qty > 0;
                  const isMaxed = qty >= max;
                  const isTrigger = (offer.bundleRules || []).some((r) => r.triggerVariantId === v.id);

                  return (
                    <div
                      key={v.id}
                      className={`rounded-lg border-2 p-3 transition-colors ${
                        isActive ? "border-[#ff5c00] bg-orange-50" : "border-gray-200"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            {v.attributes.length === 0 ? (
                              <span className="text-xs text-gray-500">افتراضي</span>
                            ) : (
                              v.attributes.map((a, i) => (
                                <span key={i} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
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
                                      {t.maxQty !== null ? `-${t.maxQty}` : "+"}: {formatMoney(t.unitPrice)}
                                    </span>
                                  ))}
                                </span>
                              )
                            ) : (
                              <span className="text-red-600">لا شرائح سعر</span>
                            )}
                            <span>
                              · مخزون: <strong className={max === 0 ? "text-red-600" : "text-gray-900"}>{max}</strong>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => decrementManual(v.id)}
                            disabled={qty <= 0}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500 text-gray-600 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={qty === 0 ? "" : String(qty)}
                            onChange={(e) => setDirectManual(v.id, e.target.value)}
                            placeholder="0"
                            className="h-9 w-14 rounded-lg border-2 border-gray-200 text-center text-sm font-bold focus:border-[#ff5c00] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => incrementManual(v.id)}
                            disabled={isMaxed}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500 text-gray-600 transition hover:bg-green-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      {price !== undefined && qty > 0 && (
                        <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-1 text-xs">
                          <span className="text-gray-600">{qty} × {formatMoney(price)} د.م</span>
                          <span className="font-bold text-[#ff5c00]">{formatMoney(price * qty)} د.م</span>
                        </div>
                      )}
                      {isMaxed && max > 0 && (
                        <p className="mt-1 text-[11px] text-amber-700">الحد الأقصى المتاح {max} قطعة</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">البائع</h3>
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                <Building2 className="h-4 w-4 text-gray-400" />
                {offer.sellerName}
              </p>
              <p className="text-xs text-gray-500">{BU_TYPE_LABEL[offer.sellerType] ?? offer.sellerType}</p>
              {offer.sellerVerificationStatus === "VERIFIED" && (
                <Badge variant="green" size="sm">
                  <ShieldCheck className="h-3 w-3" /> نشاط موثق
                </Badge>
              )}
              <p className="text-xs text-gray-500">عضو منذ {formatDate(offer.createdAt)}</p>
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
                  <span className={`font-bold ${minMet ? "text-gray-900" : "text-red-600"}`}>{totalQty}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">الحد الأدنى</span>
                  <span className="text-gray-700">{offer.minOrderQty}</span>
                </div>
                {offer.maxOrderQty !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">الحد الأقصى</span>
                    <span className={maxExceeded ? "font-bold text-red-600" : "text-gray-700"}>{offer.maxOrderQty}</span>
                  </div>
                )}
                {totalEstimate > 0 && (
                  <div className="flex justify-between border-t pt-2 text-base">
                    <span className="font-bold">الإجمالي</span>
                    <span className="font-black text-[#ff5c00]">{formatMoney(totalEstimate)} د.م</span>
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

      {/* Bundle Prompt Modal (manual mode only) */}
      {bundlePrompt && !offer.autoBalanceEnabled && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setBundlePrompt(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Link2 className="h-5 w-5 text-amber-500" /> شرط شراء مرتبط
              </h3>
              <button onClick={() => setBundlePrompt(null)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-gray-700">
              شراء <strong className="text-[#ff5c00]">{bundlePrompt.triggerLabel}</strong> (سيتحول إلى {bundlePrompt.newTriggerQty}) يتطلب إضافة:
            </p>
            <div className="mb-4 space-y-2">
              {bundlePrompt.rows.map((row) => (
                <div
                  key={row.variantId}
                  className={`rounded-lg border p-2 text-sm ${
                    row.wouldExceed ? "border-red-300 bg-red-50" : row.delta > 0 ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 font-medium text-gray-900">{row.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        row.wouldExceed ? "bg-red-200 text-red-800" : row.delta > 0 ? "bg-amber-200 text-amber-800" : "bg-green-200 text-green-800"
                      }`}
                    >
                      {row.wouldExceed ? `⚠ يحتاج ${row.current + row.delta} / متاح ${row.stock}` : row.delta > 0 ? `+${row.delta}` : `✓ لديك ${row.current}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {hasBlockingRow && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                لا يمكن المتابعة — المخزون غير كافٍ لبعض الخيارات.
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setBundlePrompt(null)} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">
                إلغاء
              </button>
              <button
                onClick={confirmBundlePrompt}
                disabled={hasBlockingRow}
                className="flex-1 rounded-lg bg-[#ff5c00] px-3 py-2 text-sm font-bold text-gray-600 hover:bg-[#e64a00] disabled:opacity-50 disabled:cursor-not-allowed"
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