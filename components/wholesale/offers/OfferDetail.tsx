"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Tag,
  Package,
  ShieldCheck,
  ShieldX,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Layers,
  Building2,
  ExternalLink,
  Store,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { OfferActions } from "./OfferActions";
import TransferToStoreModal from "./TransferToStoreModal";
import BundleRulesEditor from "./BundleRulesEditor";
import PackagesEditor from "./PackagesEditor";
import AutoBalanceEditor from "./AutoBalanceEditor";
import {
  OFFER_STATUS_LABEL,
  OFFER_STATUS_VARIANT,
  CLAIM_TYPE_LABEL,
  REVIEW_LEVEL_LABEL,
  BU_TYPE_LABEL,
  formatDate,
  formatDateTime,
  type OfferDetail as OfferDetailType,
} from "./types";

export interface OfferDetailProps {
  offer: OfferDetailType;
  isAdmin: boolean;
  isOwner: boolean;
}

export function OfferDetail({ offer, isAdmin, isOwner }: OfferDetailProps) {
  const [currentStatus, setCurrentStatus] = useState(offer.status);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Compute price range across all tiers
  const allPrices: number[] = [];
  const allMins: number[] = [];
  for (const v of offer.variants) {
    for (const t of v.tiers) {
      allPrices.push(t.unitPrice);
      allMins.push(t.minQty);
    }
  }
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : 0;
  const minOrder = allMins.length > 0 ? Math.min(...allMins) : offer.minOrderQty;

  return (
    <div className="space-y-5">
      <Link
        href="/wholesale/offers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للعروض
      </Link>

      <PageHeader
        title={offer.masterName}
        description={
          (offer.master.brand ? offer.master.brand + " · " : "") +
          offer.businessUnitName
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={OFFER_STATUS_VARIANT[currentStatus] ?? "gray"}
              dot
            >
              {OFFER_STATUS_LABEL[currentStatus] ?? currentStatus}
            </Badge>
            {offer.claimVerified && (
              <Badge variant="green">
                <ShieldCheck className="h-3 w-3" />
                موثق
              </Badge>
            )}
          </div>
        }
      />

      {/* Status banners */}
      {currentStatus === "PENDING_REVIEW" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">العرض بانتظار المراجعة</p>
              <p className="mt-1 text-amber-800">
                سيراجع فريقنا العرض قريبًا. عادةً ما تتم المراجعة خلال 24 ساعة.
              </p>
            </div>
          </div>
        </div>
      )}
      {currentStatus === "REJECTED" && offer.notes && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">تم رفض العرض</p>
              <p className="mt-1 text-red-800">{offer.notes}</p>
            </div>
          </div>
        </div>
      )}
      {currentStatus === "SUSPENDED" && offer.notes && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldX className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">العرض موقوف إداريًا</p>
              <p className="mt-1 text-red-800">{offer.notes}</p>
            </div>
          </div>
        </div>
      )}
      {currentStatus === "ACTIVE" && !offer.claimVerified && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            المطالبة بحالة "
            {CLAIM_TYPE_LABEL[offer.claimType] ?? offer.claimType}
            " لم تُتحقق بعد. يمكن للتجار طلب إثبات قبل الشراء.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Master product info */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              المنتج الأصلي
            </h3>
            <div className="flex items-start gap-4">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50">
                {offer.master.images[0] ? (
                  <img
                    src={offer.master.images[0]}
                    alt={offer.master.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-8 w-8 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">
                  {offer.master.name}
                </p>
                {offer.master.brand && (
                  <p className="text-sm text-gray-500">{offer.master.brand}</p>
                )}
                {offer.master.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                    {offer.master.description}
                  </p>
                )}
                <Link
                  href={`/wholesale/master-products/${offer.masterId}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#ff5c00] hover:underline"
                >
                  تفاصيل المنتج
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </Card>

          {/* Variants + tiers */}
          <Card padding="none">
            <div className="border-b border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Layers className="h-4 w-4 text-gray-400" />
                المتغيرات والأسعار ({offer.variants.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {offer.variants.map((v) => (
                <div key={v.id} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {v.attributes.length === 0 ? (
                      <span className="text-xs font-medium text-gray-500">
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
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        (v.availableStock ?? 0) > 0
                          ? (v.availableStock ?? 0) < 10
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      مخزون: {v.availableStock ?? 0}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {v.tiers.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded bg-gray-50 px-3 py-1.5 text-xs"
                      >
                        <span className="text-gray-600">
                          {t.minQty}
                          {t.maxQty !== null ? `–${t.maxQty}` : "+"} قطعة
                        </span>
                        <span className="font-bold text-gray-900">
                          {t.unitPrice} د.م/قطعة
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Claim info */}
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              المطالبة
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-600">النوع</dt>
                <dd className="font-medium text-gray-900">
                  {CLAIM_TYPE_LABEL[offer.claimType] ?? offer.claimType}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-600">الحالة</dt>
                <dd>
                  {offer.claimVerified ? (
                    <Badge variant="green">
                      <CheckCircle2 className="h-3 w-3" />
                      موثق
                    </Badge>
                  ) : (
                    <Badge variant="yellow">بانتظار التحقق</Badge>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-600">مستوى المراجعة</dt>
                <dd className="text-gray-900">
                  {REVIEW_LEVEL_LABEL[offer.reviewLevel] ?? offer.reviewLevel}
                </dd>
              </div>
              {offer.claimProofUrl && (
                <div className="border-t border-gray-100 pt-2">
                  <dt className="mb-1 text-xs text-gray-500">إثبات المطالبة</dt>
                  <dd>
                    <a
                      href={offer.claimProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#ff5c00] hover:underline"
                    >
                      عرض الإثبات
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </dd>
                </div>
              )}
              {offer.claimNotes && (
                <div className="border-t border-gray-100 pt-2">
                  <dt className="mb-1 text-xs text-gray-500">ملاحظات</dt>
                  <dd className="text-sm text-gray-700">{offer.claimNotes}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-900">
              نظرة سريعة
            </h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-gray-500">نطاق السعر</dt>
                <dd className="font-bold text-gray-900">
                  {minPrice === maxPrice
                    ? `${minPrice} د.م`
                    : `${minPrice} – ${maxPrice} د.م`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">الحد الأدنى للطلب</dt>
                <dd className="text-gray-900">{minOrder} قطعة</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">النشاط التجاري</dt>
                <dd className="flex items-center gap-1 text-gray-900">
                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                  {offer.businessUnitName}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">نوع النشاط</dt>
                <dd className="text-gray-900">
                  {BU_TYPE_LABEL[offer.businessUnitType] ??
                    offer.businessUnitType}
                </dd>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <dt className="text-xs text-gray-500">تاريخ الإنشاء</dt>
                <dd className="text-xs text-gray-700">
                  {formatDate(offer.createdAt)}
                </dd>
              </div>
              {offer.approvedAt && (
                <div>
                  <dt className="text-xs text-gray-500">تاريخ الاعتماد</dt>
                  <dd className="text-xs text-gray-700">
                    {formatDateTime(offer.approvedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <OfferActions
            offerId={offer.id}
            currentStatus={currentStatus}
            isAdmin={isAdmin}
            isOwner={isOwner}
            onStatusChange={setCurrentStatus}
          />
          {isOwner && currentStatus !== "ARCHIVED" && currentStatus !== "SUSPENDED" && (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <h3 className="flex items-center gap-2 text-sm font-bold">
                    <Store className="h-4 w-4 text-emerald-600" />
                    نقل إلى المتجر
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    انقل مخزون الجملة إلى متجر التجزئة الخاص بك
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(true)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  نقل
                </button>
              </div>
            </Card>
          )}

          {isOwner && currentStatus !== "ARCHIVED" && currentStatus !== "SUSPENDED" && (
            <AutoBalanceEditor
              offerId={offer.id}
              variants={offer.variants.map((v) => ({
                id: v.id,
                attributes: v.attributes,
                availableStock: v.availableStock ?? 0,
              }))}
              initialEnabled={offer.autoBalanceEnabled ?? false}
              initialBundleRulesCount={offer.bundleRules?.length ?? 0}
              initialRequireSizeSelection={offer.requireSizeSelection ?? false}
            />
          )}

          {isOwner && currentStatus !== "ARCHIVED" && currentStatus !== "SUSPENDED" && (
            <PackagesEditor
              offerId={offer.id}
              variants={offer.variants.map((v) => ({ id: v.id, attributes: v.attributes }))}
              initialPackages={offer.packages ?? []}
            />
          )}

          {isOwner && currentStatus !== "ARCHIVED" && currentStatus !== "SUSPENDED" && (
            <BundleRulesEditor
              offerId={offer.id}
              variants={offer.variants.map((v) => ({ id: v.id, attributes: v.attributes }))}
              initialRules={offer.bundleRules ?? []}
            />
          )}
        </div>
      </div>
      {showTransferModal && (
        <TransferToStoreModal
          offerId={offer.id}
          onClose={() => setShowTransferModal(false)}
          onSuccess={(r) => {
            setShowTransferModal(false);
            window.location.href = `/seller/products/${r.productId}`;
          }}
        />
      )}
    </div>
  );
}