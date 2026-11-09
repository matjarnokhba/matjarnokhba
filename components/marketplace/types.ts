export type PublicOfferItem = {
  id: number;
  masterId: number;
  masterName: string;
  masterBrand: string | null;
  masterImage: string | null;
  sellerName: string;
  sellerType: string;
  sellerVerificationStatus: string;
  wholesalePrice: number;
  minPrice: number;
  maxPrice: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  claimType: string;
  claimVerified: boolean;
  variantCount: number;
  createdAt: string;
};

export type PublicOfferDetail = PublicOfferItem & {
  description: string | null;
  businessUnitSlug: string;
  master: {
    id: number;
    name: string;
    brand: string | null;
    description: string | null;
    images: string[];
    barcode: string | null;
  };
  variants: Array<{
    id: number;
    masterVariantId: number;
    attributes: Array<{ name: string; value: string }>;
    tiers: Array<{
      id: number;
      minQty: number;
      maxQty: number | null;
      unitPrice: number;
    }>;
  }>;
  bundleRules?: Array<{
    id: number;
    triggerVariantId: number;
    requiredVariantId: number;
    minQuantity: number;
    notes: string | null;
  }>;
};

export type BuyerBU = {
  id: number;
  name: string;
  type: string;
};

export type MarketplaceFilters = {
  search: string;
  categoryId: string;
  businessType: string;
  claimVerified: string;
  minPrice: string;
  maxPrice: string;
};

export function formatNumber(n: number): string {
  return n.toLocaleString("ar-MA");
}