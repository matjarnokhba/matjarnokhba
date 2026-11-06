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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  CLAIM_TYPE_LABEL,
  BU_TYPE_LABEL,
  formatDate,
  formatMoney,
} from "@/components/wholesale/offers/types";
import type { PublicOfferDetail, BuyerBU } from "./types";
import { useWholesaleCart } from "@/lib/hooks/useWholesaleCart";
import { useToast } from "@/lib/hooks/useToast";

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
  const [selectedVariantId, setSelectedVariantId] = useState<number>(
    offer.variants[0]?.id ?? 0
  );
  const [quantity, setQuantity] = useState<string>(
    String(offer.minOrderQty)
  );
  const router = useRouter();
  const { toast } = useToast();
  const { addItem } = useWholesaleCart();

  const selectedVariant = offer.variants.find(
    (v) => v.id === selectedVariantId
  );

  // Current tier price for selected variant + quantity
  const computedPrice = useMemo(() => {
    if (!selectedVariant) return null;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return null;
    for (const tier of selectedVariant.tiers) {
      if (
        qty >= tier.minQty &&
        (tier.maxQty === null || qty <= tier.maxQty)
      ) {
        return { unitPrice: tier.unitPrice, total: tier.unitPrice * qty };
      }
    }
    return null;
  }, [selectedVariant, quantity]);

  const canOrder =
    !isOwnOffer &&
    buyerBUs.length > 0 &&
    quantity.length > 0 &&
    parseInt(quantity, 10) >= offer.minOrderQty &&
    (offer.maxOrderQty === null ||
      parseInt(quantity, 10) <= offer.maxOrderQty) &&
    computedPrice !== null;

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

      {/* Own offer warning */}
      {isOwnOffer && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="inline h-4 w-4" /> هذا عرضك — لا يمكنك شراء
          منتجك الخاص.
        </div>
      )}

      {/* No buyer BU warning */}
      {!isOwnOffer && buyerBUs.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="inline h-4 w-4" /> تحتاج نشاطًا بصلاحية
          الشراء بالجملة لتتمكن من الطلب.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main: images + description */}
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
              <h3 className="mb-2 text-sm font-bold text-gray-900">
                الوصف
              </h3>
              <p className="whitespace-pre-wrap text-sm text-gray-700">
                {offer.master.description}
              </p>
            </Card>
          )}

          {/* Variants */}
          <Card>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Layers className="h-4 w-4 text-gray-400" />
              المتغيرات والأسعار ({offer.variants.length})
            </h3>
            <div className="space-y-2">
              {offer.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setQuantity(String(offer.minOrderQty));
                  }}
                  className={`w-full rounded-lg border-2 p-3 text-right transition-all ${
                    selectedVariantId === v.id
                      ? "border-[#ff5c00] bg-orange-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1">
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
                    {selectedVariantId === v.id && (
                      <CheckCircle2 className="mr-auto h-4 w-4 text-[#ff5c00]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {v.tiers.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-gray-600">
                          {t.minQty}
                          {t.maxQty !== null ? `–${t.maxQty}` : "+"} قطعة
                        </span>
                        <span className="font-bold text-gray-900">
                          {formatMoney(t.unitPrice)} د.م/قطعة
                        </span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar: seller + order form */}
        <div className="space-y-4">
          {/* Seller info */}
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

          {/* Order form */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              اطلب الآن
            </h3>

            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                المتغير
              </label>
              <Select
                value={String(selectedVariantId)}
                onChange={(e) =>
                  setSelectedVariantId(parseInt(e.target.value, 10))
                }
                options={offer.variants.map((v) => ({
                  value: String(v.id),
                  label:
                    v.attributes.length === 0
                      ? "متغير افتراضي"
                      : v.attributes.map((a) => `${a.name}: ${a.value}`).join(" · "),
                }))}
              />
            </div>

            <div className="mb-3">
              <Input
                label="الكمية"
                type="number"
                min={String(offer.minOrderQty)}
                max={offer.maxOrderQty ? String(offer.maxOrderQty) : undefined}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                hint={`الحد الأدنى: ${offer.minOrderQty}${
                  offer.maxOrderQty ? ` · الأقصى: ${offer.maxOrderQty}` : ""
                }`}
              />
            </div>

            {computedPrice && (
              <div className="mb-3 rounded-lg bg-orange-50 p-3">
                <p className="text-xs text-orange-700">السعر المحسوب</p>
                <p className="text-xs text-gray-600">
                  {formatMoney(computedPrice.unitPrice)} د.م × {quantity}
                </p>
                <p className="text-lg font-black text-[#ff5c00]">
                  {formatMoney(computedPrice.total)} د.م
                </p>
              </div>
            )}

            {!computedPrice && quantity.length > 0 && (
              <div className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                الكمية خارج نطاق الشرائح المتاحة
              </div>
            )}

            <Button
              fullWidth
              disabled={!canOrder}
              variant="primary"
              iconLeft={<ShoppingCart className="h-4 w-4" />}
              onClick={() => {
                if (!canOrder || !selectedVariant || !computedPrice) return;
                const qty = parseInt(quantity, 10);
                addItem({
                  offerId: offer.id,
                  masterVariantId: selectedVariant.masterVariantId,
                  masterName: offer.masterName,
                  masterImage: offer.masterImage,
                  sellerName: offer.sellerName,
                  sellerType: offer.sellerType,
                  variantAttributes: selectedVariant.attributes,
                  quantity: qty,
                  unitPrice: computedPrice.unitPrice,
                  minOrderQty: offer.minOrderQty,
                  maxOrderQty: offer.maxOrderQty,
                });
                toast("تمت الإضافة إلى السلة", "success");
                router.push("/wholesale/cart");
              }}
            >
              إضافة إلى السلة
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}