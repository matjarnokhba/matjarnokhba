"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Package,
  ShieldCheck,
  Building2,
  Star,
  CheckCircle2,
  ShoppingCart,
  AlertCircle,
  Layers,
  X,
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

export function OfferDetailPublic({
  offer,
  buyerBUs,
  isOwnOffer,
}: OfferDetailPublicProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const router = useRouter();
  const { toast } = useToast();
  const { addItem } = useWholesaleCart();

  const variantPrices = useMemo(() => {
    const result = new Map<number, number>();
    for (const v of offer.variants) {
      const qty = parseInt(quantities[v.id] || "0", 10);
      if (isNaN(qty) || qty <= 0) continue;
      let tier = v.tiers.find(
        (t) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)
      );
      if (!tier && v.tiers.length > 0) tier = v.tiers[0];
      if (tier) result.set(v.id, tier.unitPrice);
    }
    return result;
  }, [quantities, offer.variants]);

  const totalQty = useMemo(() => {
    let sum = 0;
    for (const q of Object.values(quantities)) {
      sum += parseInt(q || "0", 10) || 0;
    }
    return sum;
  }, [quantities]);

  const totalEstimate = useMemo(() => {
    let total = 0;
    for (const v of offer.variants) {
      const p = variantPrices.get(v.id);
      if (p === undefined) continue;
      const qty = parseInt(quantities[v.id] || "0", 10) || 0;
      total += p * qty;
    }
    return Math.round(total * 100) / 100;
  }, [variantPrices, quantities, offer.variants]);

  const bundleViolations = useMemo(() => {
    const violations: string[] = [];
    for (const rule of offer.bundleRules || []) {
      const triggerQty =
        parseInt(quantities[rule.triggerVariantId] || "0", 10) || 0;
      if (triggerQty === 0) continue;
      const requiredQty =
        parseInt(quantities[rule.requiredVariantId] || "0", 10) || 0;
      if (requiredQty < rule.minQuantity) {
        const triggerVar = offer.variants.find((v) => v.id === rule.triggerVariantId);
        const requiredVar = offer.variants.find((v) => v.id === rule.requiredVariantId);
        violations.push(
          `شراء "${fmtAttrs(triggerVar?.attributes)}" يستلزم شراء ${rule.minQuantity} على الأقل من "${fmtAttrs(requiredVar?.attributes)}"`
        );
      }
    }
    return violations;
  }, [quantities, offer.bundleRules, offer.variants]);

  const bundleHints = useMemo(() => {
    const hints = new Map<number, string[]>();
    for (const rule of offer.bundleRules || []) {
      const triggerQty =
        parseInt(quantities[rule.triggerVariantId] || "0", 10) || 0;
      if (triggerQty === 0) continue;
      const requiredQty =
        parseInt(quantities[rule.requiredVariantId] || "0", 10) || 0;
      if (requiredQty < rule.minQuantity) {
        const triggerVar = offer.variants.find((v) => v.id === rule.triggerVariantId);
        const existing = hints.get(rule.requiredVariantId) || [];
        existing.push(`مطلوب بواسطة "${fmtAttrs(triggerVar?.attributes)}" (≥${rule.minQuantity})`);
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

  function setQty(variantId: number, val: string) {
    if (val !== "" && !/^\d+$/.test(val)) return;
    setQuantities((prev) => {
      const next = { ...prev };
      if (val === "" || val === "0") delete next[variantId];
      else next[variantId] = val;
      return next;
    });
  }

  function clearAll() {
    setQuantities({});
  }

  function handleAddToCart() {
    if (!canOrder) return;
    let added = 0;
    for (const v of offer.variants) {
      const qty = parseInt(quantities[v.id] || "0", 10);
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
    toast(
      `تمت إضافة ${added} ${added === 1 ? "خيار" : "خيارات"} إلى السلة`,
      "success"
    );
    router.push("/wholesale/cart");
  }

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
                <ShieldCheck className="h-3 w-3" />
                موثق
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
          <AlertCircle className="inline h-4 w-4" /> هذا عرضك — لا يمكنك شراء
          منتجك الخاص.
        </div>
      )}

      {!isOwnOffer && buyerBUs.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="inline h-4 w-4" /> تحتاج نشاطًا بصلاحية
          الشراء بالجملة لتتمكن من الطلب.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="mb-3 flex aspect-square max-h-[500px] items-center justify-center overflow-hidden rounded-lg bg-gray-50">
              {offer.master.images[activeImage] ? (
                <img
                  src={offer.master.images[activeImage]}
                  alt={offer.master.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Package className="h-20 w-20 text-gray-300" />
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
                      idx === activeImage
                        ? "border-[#ff5c00]"
                        : "border-gray-200"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`صورة ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </Card>

          {offer.master.description && (
            <Card>
              <h3 className="mb-2 text-sm font-bold text-gray-900">الوصف</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {offer.master.description}
              </p>
            </Card>
          )}

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Layers className="h-4 w-4 text-gray-400" />
                اختر الكميات ({offer.variants.length} خيار)
              </h3>
              {totalQty > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-gray-500 hover:text-red-600 underline"
                >
                  مسح الكل
                </button>
              )}
            </div>
            <p className="mb-3 text-xs text-gray-500">
              أدخل الكمية المطلوبة لكل لون/مقاس. المجموع يجب أن يكون ≥{" "}
              <strong>{offer.minOrderQty}</strong>
              {offer.maxOrderQty !== null && ` و≤ ${offer.maxOrderQty}`}.
            </p>

            <div className="max-h-[600px] space-y-2 overflow-y-auto">
              {offer.variants.map((v) => {
                const qty = parseInt(quantities[v.id] || "0", 10) || 0;
                const price = variantPrices.get(v.id);
                const hints = bundleHints.get(v.id);
                const isActive = qty > 0;

                return (
                  <div
                    key={v.id}
                    className={`rounded-lg border-2 p-3 transition-colors ${
                      isActive
                        ? "border-[#ff5c00] bg-orange-50"
                        : "border-gray-200"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {v.attributes.length === 0 ? (
                            <span className="text-xs text-gray-500">
                              متغير افتراضي
                            </span>
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
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {v.tiers.length > 0 ? (
                            v.tiers.length === 1 ? (
                              <>
                                السعر: {formatMoney(v.tiers[0].unitPrice)} د.م/قطعة
                              </>
                            ) : (
                              <>
                                {v.tiers.map((t, i) => (
                                  <span key={i}>
                                    {i > 0 && " · "}
                                    {t.minQty}
                                    {t.maxQty !== null ? `-${t.maxQty}` : "+"}:{" "}
                                    {formatMoney(t.unitPrice)}
                                  </span>
                                ))}
                              </>
                            )
                          ) : (
                            <span className="text-red-600">لا توجد شرائح سعر</span>
                          )}
                        </div>
                        {hints && hints.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {hints.map((h, i) => (
                              <p key={i} className="text-xs text-amber-700">
                                ⚠ {h}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          value={quantities[v.id] || ""}
                          onChange={(e) => setQty(v.id, e.target.value)}
                          className="w-full rounded-lg border-2 border-gray-200 px-2 py-1.5 text-center text-sm font-bold focus:border-[#ff5c00] focus:outline-none"
                        />
                      </div>
                    </div>
                    {price !== undefined && qty > 0 && (
                      <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
                        <span className="text-gray-600">
                          {qty} × {formatMoney(price)} د.م
                        </span>
                        <span className="font-bold text-[#ff5c00]">
                          {formatMoney(price * qty)} د.م
                        </span>
                      </div>
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
                  <ShieldCheck className="h-3 w-3" />
                  نشاط موثق
                </Badge>
              )}
              <p className="text-xs text-gray-500">
                عضو منذ {formatDate(offer.createdAt)}
              </p>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">ملخص الطلب</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">عدد الخيارات</span>
                <span className="font-medium">
                  {Object.keys(quantities).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">إجمالي القطع</span>
                <span
                  className={`font-bold ${
                    minMet ? "text-gray-900" : "text-red-600"
                  }`}
                >
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
                  <span
                    className={
                      maxExceeded ? "font-bold text-red-600" : "text-gray-700"
                    }
                  >
                    {offer.maxOrderQty}
                  </span>
                </div>
              )}
              {totalEstimate > 0 && (
                <div className="flex justify-between border-t pt-2 text-base">
                  <span className="font-bold">الإجمالي التقديري</span>
                  <span className="font-black text-[#ff5c00]">
                    {formatMoney(totalEstimate)} د.م
                  </span>
                </div>
              )}
            </div>

            {!minMet && totalQty > 0 && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                يتبقى {offer.minOrderQty - totalQty} قطعة للوصول إلى الحد الأدنى
              </div>
            )}
            {maxExceeded && (
              <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                تجاوزت الحد الأقصى بـ {totalQty - (offer.maxOrderQty || 0)} قطعة
              </div>
            )}
            {bundleViolations.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2">
                {bundleViolations.map((v, i) => (
                  <p
                    key={i}
                    className="flex items-start gap-1 text-xs text-amber-800"
                  >
                    <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />{" "}
                    {v}
                  </p>
                ))}
              </div>
            )}
            {totalQty > 0 &&
              minMet &&
              !maxExceeded &&
              bundleViolations.length === 0 && (
                <div className="mt-3 flex items-center gap-1 rounded-lg bg-green-50 p-2 text-xs text-green-700">
                  <CheckCircle2 className="h-3 w-3" /> الطلب صالح للإرسال
                </div>
              )}

            <div className="mt-3 flex gap-2">
              {totalQty > 0 && (
                <Button variant="secondary" onClick={clearAll}>
                  <X className="h-4 w-4" /> مسح
                </Button>
              )}
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
  );
}