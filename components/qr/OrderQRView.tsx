"use client";

import Link from "next/link";
import {
  ArrowRight,
  Package,
  User,
  Phone,
  MapPin,
  Truck,
  Store,
  Warehouse,
  Shield,
  AlertCircle,
  ShoppingBag,
} from "lucide-react";

type QRRouteResult = {
  view: string;
  redirect?: string;
  order?: any;
  shipment?: any;
  actions: string[];
};

const CURRENCY = "د.م";

// ═══ تنسيق الحالة ═══
function statusLabel(s: string): string {
  const map: Record<string, string> = {
    NEW: "جديد",
    PROCESSING: "قيد التجهيز",
    SHIPPED: "تم الشحن",
    PARTIALLY_DELIVERED: "تسليم جزئي",
    DELIVERED: "تم التسليم",
    CANCELLED: "ملغى",
    RETURNED: "مُرجع",
    PENDING: "قيد الانتظار",
    PREPARING: "قيد التجهيز",
    READY_FOR_COLLECTION: "جاهز للجمع",
    COLLECTED: "تم الجمع",
    IN_TRANSIT_TO_WAREHOUSE: "في الطريق للمستودع",
    RECEIVED: "وصل المستودع",
    VERIFIED: "تم التحقق",
    AVAILABLE_FOR_SHIPMENT: "جاهز للشحن",
    ALLOCATED: "مُخصص",
    DRAFT: "مسودة",
    ASSIGNED: "مُسند",
    PICKED_UP: "تم الاستلام",
    OUT_FOR_DELIVERY: "قيد التوصيل",
    IN_TRANSIT: "قيد النقل",
    POSTPONED: "مؤجل",
    REFUSED: "مرفوض",
  };
  return map[s] || s;
}

// ═══ بطاقة معلومة ═══
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-gray-500">{label}</div>
        <div className="mt-0.5 text-sm font-bold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

// ═══ Header ═══
function ViewHeader({
  title,
  subtitle,
  color,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  color: string;
  icon: any;
}) {
  return (
    <div
      className="mb-4 rounded-2xl p-5 text-white shadow-md"
      style={{ background: color }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-lg font-black">{title}</h1>
          <p className="mt-0.5 text-xs opacity-90">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// ═══ Order Card ═══
function OrderCard({
  order,
  showPII,
}: {
  order: any;
  showPII: boolean;
}) {
  const customer = order.customerSnapshot || {};
  const address = order.shippingAddressSnapshot || {};

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-gray-500">رقم الطلب</div>
          <div className="mt-0.5 font-mono text-base font-black text-gray-900">
            {order.orderNumber}
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700">
          {statusLabel(order.status)}
        </span>
      </div>

      <div className="mb-4">
        <InfoRow
          icon={Package}
          label="المصدر"
          value={order.source === "IN_STORE" ? "بيع في المتجر" : "طلب إلكتروني"}
        />
        <InfoRow
          icon={ShoppingBag}
          label="عدد العناصر"
          value={order.items?.length ?? 0}
        />
        <InfoRow
          icon={Package}
          label="المجموع"
          value={`${Number(order.total).toFixed(2)} ${CURRENCY}`}
        />
        {showPII && customer.name && (
          <InfoRow icon={User} label="العميل" value={customer.name} />
        )}
        {showPII && customer.phone && (
          <InfoRow
            icon={Phone}
            label="الهاتف"
            value={<span dir="ltr">{customer.phone}</span>}
          />
        )}
        {showPII && address.city && (
          <InfoRow
            icon={MapPin}
            label="العنوان"
            value={`${address.street || ""}، ${address.city}`}
          />
        )}
      </div>

      {/* العناصر */}
      {order.items && order.items.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <div className="mb-2 text-xs font-black text-gray-700">المنتجات</div>
          <div className="space-y-2">
            {order.items.slice(0, 5).map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.productName}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-200">
                    <Package className="h-4 w-4 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">
                    {item.productName}
                  </div>
                  {item.variantName && (
                    <div className="text-[10px] text-gray-500">
                      {item.variantName}
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold">×{item.quantity}</div>
              </div>
            ))}
            {order.items.length > 5 && (
              <div className="text-center text-[11px] text-gray-500">
                +{order.items.length - 5} منتجات أخرى
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ Action Button ═══
function ActionButton({
  href,
  label,
  color,
  icon: Icon,
}: {
  href: string;
  label: string;
  color: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
      style={{ background: color }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

// ═══════════════════════════════════════════
// Main View
// ═══════════════════════════════════════════
export default function OrderQRView({ result }: { result: QRRouteResult }) {
  const { view, order, actions } = result;

  // ═══ Customer Owner ═══
  if (view === "customer_owner" && order) {
    return (
      <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
        <Link
          href="/orders"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          طلباتي
        </Link>

        <ViewHeader
          title="طلبك"
          subtitle="تفاصيل الطلب والإجراءات المتاحة"
          color="linear-gradient(135deg, #ff5c00, #e64a00)"
          icon={ShoppingBag}
        />

        <OrderCard order={order} showPII={true} />

        {actions.length > 0 && (
          <div className="mt-4 space-y-2">
            {actions.includes("cancel") && (
              <ActionButton
                href={`/orders/${order.id}`}
                label="عرض التفاصيل / إلغاء"
                color="#dc2626"
                icon={AlertCircle}
              />
            )}
            {actions.includes("return") && (
              <ActionButton
                href={`/orders/${order.id}`}
                label="طلب إرجاع"
                color="#ea580c"
                icon={Package}
              />
            )}
            {actions.includes("review") && (
              <ActionButton
                href={`/orders/${order.id}`}
                label="تقييم المنتجات"
                color="#16a34a"
                icon={Package}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // ═══ Seller ═══
  if (view === "seller" && order) {
    return (
      <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
        <Link
          href="/seller/orders"
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          طلباتي
        </Link>

        <ViewHeader
          title="طلب من متجرك"
          subtitle="بيانات الطلب الخاصة بمنتجاتك"
          color="linear-gradient(135deg, #2563eb, #1d4ed8)"
          icon={Store}
        />

        <OrderCard order={order} showPII={order.source === "IN_STORE"} />

        <div className="mt-4">
          <ActionButton
            href={`/seller/orders/${order.id}`}
            label="فتح الطلب في لوحة التحكم"
            color="#2563eb"
            icon={Store}
          />
        </div>
      </div>
    );
  }

  // ═══ Collector ═══
  if (view === "collector" && order) {
    return (
      <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
        <ViewHeader
          title="مهمة جمع"
          subtitle="تفاصيل الطلب — بانتظار تعليمات الجمع"
          color="linear-gradient(135deg, #7c3aed, #6d28d9)"
          icon={Truck}
        />

        <OrderCard order={order} showPII={false} />

        <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-xs text-purple-800">
          ⚠️ إجراءات الجمع (استلام من التاجر / تسليم للمستودع) ستُفعَّل في
          المرحلة B.
        </div>
      </div>
    );
  }

  // ═══ Warehouse Manager ═══
  if (view === "warehouse_manager" && (order || result.shipment)) {
    const entity = order || result.shipment;
    return (
      <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
        <ViewHeader
          title="عملية مستودع"
          subtitle="بيانات للفرز والتجميع"
          color="linear-gradient(135deg, #0f766e, #115e59)"
          icon={Warehouse}
        />

        {order ? (
          <OrderCard order={order} showPII={false} />
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-base font-black">
              شحنة {entity.shipmentNumber}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              الحالة: {statusLabel(entity.status)}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-4 text-xs text-teal-800">
          ⚠️ إجراءات الاستلام والفرز ستُفعَّل في المرحلة B.
        </div>
      </div>
    );
  }

  // ═══ Delivery Assigned ═══
  if (view === "delivery_assigned" && (order || result.shipment)) {
    const entity = order || result.shipment;
    return (
      <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
        <Link
          href={
            result.shipment
              ? `/delivery/shipments/${entity.id}`
              : `/delivery/orders/${entity.id}`
          }
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-[#ff5c00]"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          مهامي
        </Link>

        <ViewHeader
          title="مهمة توصيل"
          subtitle="تفاصيل التوصيل والإجراءات"
          color="linear-gradient(135deg, #ea580c, #c2410c)"
          icon={Truck}
        />

        {order ? (
          <OrderCard order={order} showPII={true} />
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-base font-black">
              شحنة {entity.shipmentNumber}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              الحالة: {statusLabel(entity.status)}
            </div>
            <div className="mt-3 text-xs text-gray-500">
              المجموع المطلوب:{" "}
              <span className="font-bold">
                {Number(entity.totalCOD || 0).toFixed(2)} {CURRENCY}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4">
          <ActionButton
            href={
              result.shipment
                ? `/delivery/shipments/${entity.id}`
                : `/delivery/orders/${entity.id}`
            }
            label="فتح شاشة التسليم"
            color="#ea580c"
            icon={Truck}
          />
        </div>
      </div>
    );
  }

  // ═══ Admin ═══
  if (view === "admin" && (order || result.shipment)) {
    const entity = order || result.shipment;
    return (
      <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
        <ViewHeader
          title="عرض إداري"
          subtitle="بيانات كاملة + إجراءات إدارية"
          color="linear-gradient(135deg, #374151, #1f2937)"
          icon={Shield}
        />

        {order ? (
          <OrderCard order={order} showPII={true} />
        ) : (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-base font-black">
              شحنة {entity.shipmentNumber}
            </div>
            <div className="mt-2 text-xs text-gray-600">
              الحالة: {statusLabel(entity.status)}
            </div>
          </div>
        )}

        <div className="mt-4">
          <ActionButton
            href={
              result.shipment
                ? `/admin/shipments/${entity.id}`
                : `/admin/orders/${entity.id}`
            }
            label="فتح في لوحة التحكم"
            color="#374151"
            icon={Shield}
          />
        </div>
      </div>
    );
  }

  // ═══ Fallback ═══
  return (
    <div className="mx-auto max-w-2xl p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h2 className="mt-3 text-base font-black">لا يمكن عرض هذه الصفحة</h2>
        <Link
          href="/"
          className="mt-4 inline-block rounded-full bg-[#ff5c00] px-6 py-2 text-xs font-bold text-white"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}