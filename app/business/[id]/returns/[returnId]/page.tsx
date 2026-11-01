"use client";
import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, RotateCcw, Package, CheckCircle2, XCircle, Clock, DollarSign } from "lucide-react";

type ReturnItem = {
  id: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  condition: string | null;
  notes: string | null;
  orderItem: { id: number; productName: string; sku: string | null; quantity: number };
  masterVariant: { id: number; sku: string | null; barcode: string | null; options: any };
};

type HistoryEntry = { id: number; fromStatus: string | null; toStatus: string; notes: string | null; createdAt: string; changedByUser: { id: number; name: string } };

type Return = {
  id: number;
  returnNumber: string;
  status: string;
  reason: string;
  reasonDetails: string | null;
  totalAmount: number;
  approvedAmount: number | null;
  sellerNotes: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  order: { id: number; orderNumber: string; status: string; total: number };
  buyerBusiness: { id: number; name: string; city: string; logo: string | null };
  sellerBusiness: { id: number; name: string; city: string; logo: string | null };
  requestedBy: { id: number; name: string };
  items: ReturnItem[];
  statusHistory: HistoryEntry[];
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  REQUESTED: { label: "بانتظار القرار", color: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "مقبول", color: "bg-blue-100 text-blue-700" },
  REJECTED: { label: "مرفوض", color: "bg-red-100 text-red-700" },
  RECEIVED: { label: "مستلم", color: "bg-purple-100 text-purple-700" },
  REFUNDED: { label: "مسترد", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "ملغى", color: "bg-gray-200 text-gray-700" },
};

const REASON_LABEL: Record<string, string> = {
  DAMAGED: "منتج تالف", WRONG_PRODUCT: "منتج مختلف", NOT_AS_DESCRIBED: "مخالف للوصف", QUALITY_ISSUE: "مشكلة جودة", OTHER: "أخرى",
};

function ReturnDetail() {
  const params = useParams();
  const search = useSearchParams();
  const bizId = parseInt(params.id as string);
  const returnId = parseInt(params.returnId as string);
  const side = (search.get("side") || "buyer") as "buyer" | "seller";

  const [loading, setLoading] = useState(true);
  const [ret, setRet] = useState<Return | null>(null);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [sellerNotes, setSellerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/returns/${returnId}`);
      const d = await res.json();
      if (d.success) {
        setRet(d.return);
        setApprovedAmount(String(Number(d.return.approvedAmount ?? d.return.totalAmount)));
      } else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [bizId, returnId]);

  async function handleAction(action: string, extra: any = {}) {
    setActionLoading(true); setError("");
    try {
      const res = await fetch(`/api/business/${bizId}/returns/${returnId}/action`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const d = await res.json();
      if (d.success) await load();
      else setError(d.message);
    } catch { setError("خطأ في الاتصال"); }
    finally { setActionLoading(false); }
  }

  function renderActions() {
    if (!ret) return null;
    const s = ret.status;

    if (side === "seller") {
      if (s === "REQUESTED") return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">المبلغ المعتمد</label>
            <input type="number" step="0.01" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} className="w-full rounded-lg border p-2" />
            <p className="text-xs text-gray-500 mt-1">يمكنك الموافقة بمبلغ أقل من {Number(ret.totalAmount).toFixed(2)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات (اختياري)</label>
            <textarea value={sellerNotes} onChange={(e) => setSellerNotes(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
          </div>
          <button onClick={() => handleAction("approve", { approvedAmount: parseFloat(approvedAmount), sellerNotes: sellerNotes || null })} disabled={actionLoading} className="w-full rounded-lg bg-green-600 text-white py-2.5 hover:bg-green-700 flex items-center justify-center gap-2">
            {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <CheckCircle2 className="h-4 w-4" /> موافقة
          </button>
          <div>
            <label className="block text-sm font-medium mb-1">سبب الرفض (إن رفضت)</label>
            <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} className="w-full rounded-lg border p-2 text-sm" />
          </div>
          <button onClick={() => handleAction("reject", { rejectionReason: rejectionReason || null })} disabled={actionLoading} className="w-full rounded-lg border border-red-300 text-red-600 py-2.5 hover:bg-red-50 flex items-center justify-center gap-2">
            <XCircle className="h-4 w-4" /> رفض
          </button>
        </div>
      );
      if (s === "APPROVED") return (
        <button onClick={() => handleAction("receive")} disabled={actionLoading} className="w-full rounded-lg bg-purple-600 text-white py-2.5 hover:bg-purple-700 flex items-center justify-center gap-2">
          {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <Package className="h-4 w-4" /> تأكيد استلام المرتجع
        </button>
      );
      if (s === "RECEIVED") return (
        <button onClick={() => handleAction("refund")} disabled={actionLoading} className="w-full rounded-lg bg-green-700 text-white py-2.5 hover:bg-green-800 flex items-center justify-center gap-2">
          {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />} <DollarSign className="h-4 w-4" /> إصدار الاسترداد
        </button>
      );
    }

    if (side === "buyer" && s === "REQUESTED") return (
      <button onClick={() => handleAction("cancel")} disabled={actionLoading} className="w-full rounded-lg border border-red-300 text-red-600 py-2.5 hover:bg-red-50 flex items-center justify-center gap-2">
        <XCircle className="h-4 w-4" /> إلغاء المرتجع
      </button>
    );

    return <p className="text-sm text-gray-500 text-center py-2">لا توجد إجراءات متاحة</p>;
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!ret) return <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "المرتجع غير موجود"}</div>;

  const st = STATUS_CONFIG[ret.status] || STATUS_CONFIG.REQUESTED;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/business/${bizId}/returns?side=${side}`} className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{ret.returnNumber}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${st.color}`}>{st.label}</span>
          </div>
          <p className="text-sm text-gray-600">مرتجع على طلب <Link href={`/business/${bizId}/orders/${ret.order.id}?side=${side}`} className="font-mono text-orange-600 hover:underline">{ret.order.orderNumber}</Link></p>
        </div>
      </div>

      {ret.rejectionReason && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700"><strong>سبب الرفض:</strong> {ret.rejectionReason}</div>}
      {ret.sellerNotes && <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700"><strong>ملاحظات البائع:</strong> {ret.sellerNotes}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">سبب المرتجع</h2>
            <p className="text-sm font-medium">{REASON_LABEL[ret.reason] || ret.reason}</p>
            {ret.reasonDetails && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{ret.reasonDetails}</p>}
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">البنود ({ret.items.length})</h2>
            <div className="space-y-3">
              {ret.items.map((it) => (
                <div key={it.id} className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0">
                  <Package className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <p className="font-medium">{it.orderItem.productName}</p>
                    {it.masterVariant.options && <p className="text-xs text-gray-500">{Object.entries(it.masterVariant.options).map(([k, v]) => `${k}: ${v}`).join(" / ")}</p>}
                    <p className="text-xs text-gray-500 mt-1">{it.quantity} × {Number(it.unitPrice).toFixed(2)} = <span className="font-semibold">{Number(it.subtotal).toFixed(2)}</span></p>
                    {it.condition && <p className="text-xs text-gray-600 mt-1">الحالة: {it.condition}</p>}
                    {it.notes && <p className="text-xs text-gray-600">{it.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 mt-3 flex justify-between font-bold">
              <span>الإجمالي</span>
              <span className="text-orange-600">{Number(ret.totalAmount).toFixed(2)} د.م</span>
            </div>
            {ret.approvedAmount != null && Number(ret.approvedAmount) !== Number(ret.totalAmount) && (
              <div className="flex justify-between text-sm mt-1">
                <span>المعتمد</span>
                <span className="font-semibold text-green-600">{Number(ret.approvedAmount).toFixed(2)} د.م</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">الإجراءات</h2>
            {renderActions()}
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">الأطراف</h2>
            <div className="text-sm space-y-2">
              <div><p className="text-xs text-gray-500">المشتري</p><p className="font-medium">{ret.buyerBusiness.name}</p><p className="text-xs text-gray-500">{ret.buyerBusiness.city}</p></div>
              <div><p className="text-xs text-gray-500">البائع</p><p className="font-medium">{ret.sellerBusiness.name}</p><p className="text-xs text-gray-500">{ret.sellerBusiness.city}</p></div>
              <div><p className="text-xs text-gray-500">أنشأه</p><p className="font-medium">{ret.requestedBy.name}</p></div>
            </div>
          </div>

          <div className="rounded-xl bg-white border p-5">
            <h2 className="font-semibold mb-3">سجل الحالة</h2>
            <div className="space-y-2">
              {ret.statusHistory.map((h) => (
                <div key={h.id} className="text-xs border-r-2 border-orange-300 pr-2">
                  <p className="font-medium">{STATUS_CONFIG[h.toStatus]?.label || h.toStatus}</p>
                  <p className="text-gray-500">{new Date(h.createdAt).toLocaleString("ar-MA")}</p>
                  <p className="text-gray-500">{h.changedByUser.name}</p>
                  {h.notes && <p className="text-gray-600 mt-1">{h.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}><ReturnDetail /></Suspense>;
}