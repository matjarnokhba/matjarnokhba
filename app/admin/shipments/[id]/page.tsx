"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Truck,
  User,
  Phone,
  MapPin,
  Package,
  Store,
  Globe,
  Printer,
  QrCode,
  UserCheck,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Building2,
} from "lucide-react";

type ShipmentItem = {
  id: number;
  orderItemId: number;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  codAmount: number;
};

type OrderGroup = {
  orderId: number;
  orderNumber: string;
  orderStatus: string;
  orderSource: string;
  customerSnapshot: any;
  shippingAddressSnapshot: any;
  items: ShipmentItem[];
};

type Shipment = {
  id: number;
  shipmentNumber: string;
  status: string;
  qrTokenPreview: string;
  qrTokenRevokedAt: string | null;
  totalCOD: number;
  totalOrders: number;
  notes: string | null;
  createdAt: string;
  assignedAt: string | null;
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
  } | null;
  deliveryPerson: {
    id: number;
    name: string;
    phone: string;
  } | null;
  orders: OrderGroup[];
};

type DeliveryPersonOption = {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  vehicleType: string | null;
  activeOrders: number;
  sameCity: boolean;
};

const STATUS_LABELS: Record<
  string,
  { label: string; cls: string }
> = {
  DRAFT: { label: "مسودة", cls: "bg-gray-100 text-gray-700" },
  READY: { label: "جاهزة", cls: "bg-blue-100 text-blue-700" },
  ASSIGNED: { label: "مُسندة", cls: "bg-purple-100 text-purple-700" },
  IN_TRANSIT: { label: "مع السائق", cls: "bg-amber-100 text-amber-700" },
  DELIVERED: { label: "تم التسليم", cls: "bg-green-100 text-green-700" },
  PARTIALLY_DELIVERED: {
    label: "تسليم جزئي",
    cls: "bg-orange-100 text-orange-700",
  },
  POSTPONED: { label: "مؤجل", cls: "bg-yellow-100 text-yellow-700" },
  REFUSED: { label: "مرفوض", cls: "bg-red-100 text-red-700" },
  RETURNED: { label: "مُرجع", cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "ملغى", cls: "bg-gray-100 text-gray-500" },
};

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [persons, setPersons] = useState<DeliveryPersonOption[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [actionError, setActionError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "الشحنة غير موجودة");
        return;
      }
      setShipment(data.shipment);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (shipmentId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  // ═══ تحميل السائقين ═══
  async function loadPersons() {
    if (!shipment) return;
    setLoadingPersons(true);
    try {
      const res = await fetch("/api/admin/delivery-persons");
      const data = await res.json();
      if (data.success) {
        const active = data.persons.filter(
          (p: any) => p.status === "ACTIVE"
        );
        // رتّب حسب الأقل انشغالاً
        active.sort((a: any, b: any) => a.activeOrders - b.activeOrders);
        setPersons(active);
      }
    } catch {
      // silent
    } finally {
      setLoadingPersons(false);
    }
  }

  function openAssignModal() {
    loadPersons();
    setActionError("");
    setShowAssignModal(true);
  }

  // ═══ إسناد سائق ═══
  async function handleAssign(personId: number) {
    setProcessing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryPersonId: personId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.message || "فشل الإسناد");
        return;
      }
      setShowAssignModal(false);
      await load();
    } catch {
      setActionError("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  // ═══ إلغاء الإسناد ═══
  async function handleUnassign() {
    setProcessing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryPersonId: null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.message || "فشل الإلغاء");
        return;
      }
      setShowAssignModal(false);
      await load();
    } catch {
      setActionError("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  // ═══ تغيير الحالة ═══
  async function changeStatus(newStatus: string) {
    if (!confirm(`تغيير الحالة إلى: ${STATUS_LABELS[newStatus]?.label || newStatus}؟`)) {
      return;
    }
    setProcessing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.message || "فشل التحديث");
        return;
      }
      await load();
    } catch {
      setActionError("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  // ═══ حذف الشحنة ═══
  async function handleDelete() {
    setProcessing(true);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.message || "فشل الحذف");
        return;
      }
      router.push("/admin/shipments");
    } catch {
      setActionError("فشل الاتصال");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="rounded-xl bg-red-50 p-8 text-center text-red-700">
          {error || "حدث خطأ"}
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_LABELS[shipment.status] || STATUS_LABELS.DRAFT;
  const canEdit =
    !["DELIVERED", "CANCELLED", "RETURNED"].includes(shipment.status);
  const isDraft = shipment.status === "DRAFT";

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href="/admin/shipments"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع للشحنات
      </Link>

      {/* ═══ Header ═══ */}
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">رقم الشحنة</div>
            <div className="mt-1 font-mono text-xl font-black">
              {shipment.shipmentNumber}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {new Date(shipment.createdAt).toLocaleString("ar-MA")}
            </div>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-xs font-bold ${statusInfo.cls}`}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* QR Preview */}
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-gray-50 p-3">
          <QrCode className="h-5 w-5 text-gray-400" />
          <div className="text-xs">
            <div className="text-gray-500">كود QR Preview</div>
            <div className="font-mono font-black" dir="ltr">
              ••••••{shipment.qrTokenPreview}
            </div>
          </div>
          {shipment.qrTokenRevokedAt && (
            <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              مُبطَل
            </span>
          )}
        </div>

        {/* أزرار الإجراءات */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/shipments/${shipment.id}/label`}
            className="flex items-center gap-2 rounded-lg bg-[#0a1f44] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1a2f54]"
          >
            <Printer className="h-3.5 w-3.5" />
            طباعة الملصق
          </Link>

          {canEdit && (
            <button
              onClick={openAssignModal}
              disabled={processing}
              className="flex items-center gap-2 rounded-lg border-2 border-[#ff5c00] bg-white px-4 py-2 text-xs font-bold text-[#ff5c00] transition hover:bg-[#fff4ed] disabled:opacity-50"
            >
              <UserCheck className="h-3.5 w-3.5" />
              {shipment.deliveryPerson ? "تغيير السائق" : "إسناد سائق"}
            </button>
          )}

          {isDraft && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={processing}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              حذف
            </button>
          )}
        </div>

        {actionError && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
      </div>

      {/* ═══ معلومات العميل + السائق ═══ */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* العميل */}
        {shipment.customer && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
              <User className="h-4 w-4 text-[#ff5c00]" />
              العميل
            </h2>
            <div className="space-y-1.5 text-sm">
              <div className="font-black">{shipment.customer.name}</div>
              <div className="text-xs text-gray-500">
                {shipment.customer.email}
              </div>
              {shipment.customer.phone && (
                <div
                  className="flex items-center gap-2 text-xs text-gray-600"
                  dir="ltr"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {shipment.customer.phone}
                </div>
              )}
            </div>
          </div>
        )}

        {/* السائق */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black">
            <Truck className="h-4 w-4 text-[#ff5c00]" />
            السائق
          </h2>
          {shipment.deliveryPerson ? (
            <div className="space-y-1.5 text-sm">
              <div className="font-black">{shipment.deliveryPerson.name}</div>
              <div
                className="flex items-center gap-2 text-xs text-gray-600"
                dir="ltr"
              >
                <Phone className="h-3.5 w-3.5" />
                {shipment.deliveryPerson.phone}
              </div>
              {shipment.assignedAt && (
                <div className="text-[10px] text-gray-400">
                  أُسند في:{" "}
                  {new Date(shipment.assignedAt).toLocaleString("ar-MA")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              لم يُسند لسائق بعد
            </div>
          )}
        </div>
      </div>

      {/* ═══ إجمالي COD ═══ */}
      <div className="mb-5 rounded-2xl bg-gradient-to-l from-[#ff5c00] to-orange-500 p-5 text-white shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-90">إجمالي COD للشحنة</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-black">
                {shipment.totalCOD.toFixed(2)}
              </span>
              <span className="text-sm font-bold opacity-90">د.م</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90">الطلبات</div>
            <div className="text-2xl font-black">{shipment.totalOrders}</div>
          </div>
        </div>
      </div>

      {/* ═══ تغيير الحالة ═══ */}
      {canEdit && (
        <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-black">تغيير الحالة</h2>
          <div className="flex flex-wrap gap-2">
            {shipment.status !== "READY" &&
              (shipment.status === "DRAFT" || shipment.status === "ASSIGNED") && (
                <button
                  onClick={() => changeStatus("READY")}
                  disabled={processing}
                  className="rounded-lg bg-blue-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-600 disabled:opacity-50"
                >
                  جاهزة
                </button>
              )}
            {shipment.status === "ASSIGNED" && (
              <button
                onClick={() => changeStatus("IN_TRANSIT")}
                disabled={processing}
                className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
              >
                مع السائق
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ الطلبات والعناصر ═══ */}
      <div className="space-y-4">
        <h2 className="text-base font-black">
          الطلبات المشمولة ({shipment.orders.length})
        </h2>

        {shipment.orders.map((group) => {
          const isOnline = group.orderSource === "ONLINE";
          const address = group.shippingAddressSnapshot;

          return (
            <div
              key={group.orderId}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              {/* رأس الطلب */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/orders/${group.orderId}`}
                      className="font-mono text-sm font-black text-[#ff5c00] hover:underline"
                    >
                      {group.orderNumber}
                    </Link>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        isOnline
                          ? "bg-blue-50 text-blue-700"
                          : "bg-[#fff4ed] text-[#ff5c00]"
                      }`}
                    >
                      {isOnline ? (
                        <>
                          <Globe className="h-2.5 w-2.5" />
                          إلكتروني
                        </>
                      ) : (
                        <>
                          <Store className="h-2.5 w-2.5" />
                          محل
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* العنوان */}
              {address && (
                <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs">
                  <div className="mb-1 flex items-center gap-1 font-black text-gray-500">
                    <MapPin className="h-3 w-3" />
                    عنوان التوصيل
                  </div>
                  <div className="font-bold">{address.fullName}</div>
                  {address.phone && (
                    <div className="text-gray-600" dir="ltr">
                      {address.phone}
                    </div>
                  )}
                  <div className="text-gray-500">
                    {address.street}، {address.city}
                    {address.postalCode && ` - ${address.postalCode}`}
                  </div>
                </div>
              )}

              {/* العناصر */}
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        className="h-12 w-12 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-100">
                        <Package className="h-5 w-5 text-gray-400" />
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
                    <div className="shrink-0 text-center">
                      <div className="text-xs font-bold">×{item.quantity}</div>
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-xs font-black text-[#ff5c00]">
                        {item.codAmount.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-gray-500">د.م</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ Modal: إسناد سائق ═══ */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">إسناد سائق</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {shipment.deliveryPerson && (
              <button
                onClick={handleUnassign}
                disabled={processing}
                className="mb-3 w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                إلغاء الإسناد الحالي
              </button>
            )}

            {loadingPersons ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-[#ff5c00]" />
              </div>
            ) : persons.length === 0 ? (
              <div className="rounded-lg bg-amber-50 p-6 text-center text-xs text-amber-800">
                لا يوجد أصحاب توصيل نشطون
              </div>
            ) : (
              <div className="space-y-2">
                {persons.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleAssign(p.id)}
                    disabled={processing}
                    className={`flex w-full items-center gap-3 rounded-lg border-2 p-3 text-right transition disabled:opacity-50 ${
                      shipment.deliveryPerson?.id === p.id
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white hover:border-[#ff5c00]"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0a1f44] to-purple-600 text-sm font-black text-white">
                      {p.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-black">
                          {p.name}
                        </span>
                        {p.sameCity && (
                          <span className="rounded-full bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-bold text-white">
                            نفس المدينة
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                        <MapPin className="h-2.5 w-2.5" />
                        {p.city}
                        <span>·</span>
                        <span dir="ltr">{p.phone}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-gray-500">
                        طلبات نشطة: <strong>{p.activeOrders}</strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {actionError && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {actionError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Modal: حذف ═══ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">حذف الشحنة؟</h3>
            <p className="mt-2 text-sm text-gray-600">
              سيتم حذف الشحنة <strong>{shipment.shipmentNumber}</strong> وكل
              عناصرها. لا يمكن التراجع.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={handleDelete}
                disabled={processing}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                نعم، احذف
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={processing}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}