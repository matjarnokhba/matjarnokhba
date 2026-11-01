"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Package, ShoppingBag, Users, FileText, ShieldCheck, ShieldAlert, Clock, ShoppingCart, Warehouse, BookOpen, ChevronLeft } from "lucide-react";

type Business = {
  id: number;
  type: string;
  status: string;
  name: string;
  slug: string;
  legalName: string | null;
  description: string | null;
  city: string;
  address: string | null;
  phone: string;
  email: string | null;
  commercialRegister: string | null;
  taxId: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  linkedSellerId: number | null;
  createdAt: string;
  members: Array<{ id: number; role: string; user: { id: number; name: string; email: string } }>;
  documents: Array<{ id: number; type: string; url: string; status: string; notes: string | null }>;
  _count: { productMasters: number; wholesaleOffers: number };
};

const TYPE_LABEL: Record<string, string> = {
  FACTORY: "مصنع", COMPANY: "شركة", SUPPLIER: "مورد", IMPORTER: "مستورد", WHOLESALE_TRADER: "تاجر جملة",
};

const STATUS_LABEL: Record<string, { label: string; color: string; Icon: any }> = {
  PENDING: { label: "قيد التوثيق", color: "bg-amber-100 text-amber-700", Icon: Clock },
  VERIFIED: { label: "موثق", color: "bg-green-100 text-green-700", Icon: ShieldCheck },
  SUSPENDED: { label: "موقوف", color: "bg-red-100 text-red-700", Icon: ShieldAlert },
  REJECTED: { label: "مرفوض", color: "bg-gray-100 text-gray-700", Icon: ShieldAlert },
};

export default function BusinessOverviewPage() {
  const params = useParams();
  const bizId = parseInt(params.id as string);
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/business/${bizId}`);
        const d = await res.json();
        if (d.success) setBusiness(d.business);
        else setError(d.message);
      } catch { setError("خطأ في الاتصال"); }
      finally { setLoading(false); }
    })();
  }, [bizId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>;
  if (!business) return <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700">{error || "النشاط غير موجود"}</div>;

  const st = STATUS_LABEL[business.status] || STATUS_LABEL.PENDING;
  const StIcon = st.Icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/business" className="rounded-lg border p-2 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{business.name}</h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.color}`}>
              <StIcon className="h-3 w-3" /> {st.label}
            </span>
          </div>
          <p className="text-sm text-gray-600">{TYPE_LABEL[business.type]} · {business.city}</p>
        </div>
      </div>

      {business.status === "REJECTED" && business.rejectionReason && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <strong>سبب الرفض:</strong> {business.rejectionReason}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white border p-5">
          <Package className="h-8 w-8 text-orange-500 mb-3" />
          <p className="text-2xl font-bold">{business._count.productMasters}</p>
          <p className="text-sm text-gray-600">منتج</p>
        </div>
        <div className="rounded-xl bg-white border p-5">
          <ShoppingBag className="h-8 w-8 text-orange-500 mb-3" />
          <p className="text-2xl font-bold">{business._count.wholesaleOffers}</p>
          <p className="text-sm text-gray-600">عرض جملة</p>
        </div>
        <div className="rounded-xl bg-white border p-5">
          <Users className="h-8 w-8 text-orange-500 mb-3" />
          <p className="text-2xl font-bold">{business.members.length}</p>
          <p className="text-sm text-gray-600">عضو</p>
        </div>
      </div>

      {/* Quick sections navigation */}
      <div>
        <h2 className="font-semibold mb-3">الأقسام</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link href={`/business/${business.id}/masters`} className="rounded-xl bg-white border p-4 hover:shadow-md transition-shadow group">
            <Package className="h-7 w-7 text-purple-500 mb-2" />
            <p className="font-medium text-sm">المنتجات</p>
            <p className="text-xs text-gray-500 mt-1">{business._count.productMasters} منتج</p>
            <ChevronLeft className="h-4 w-4 text-gray-400 mt-2 group-hover:text-orange-500" />
          </Link>
          <Link href={`/business/${business.id}/offers`} className="rounded-xl bg-white border p-4 hover:shadow-md transition-shadow group">
            <ShoppingBag className="h-7 w-7 text-amber-500 mb-2" />
            <p className="font-medium text-sm">العروض</p>
            <p className="text-xs text-gray-500 mt-1">{business._count.wholesaleOffers} عرض</p>
            <ChevronLeft className="h-4 w-4 text-gray-400 mt-2 group-hover:text-orange-500" />
          </Link>
          <Link href={`/business/${business.id}/orders?side=buyer`} className="rounded-xl bg-white border p-4 hover:shadow-md transition-shadow group">
            <ShoppingCart className="h-7 w-7 text-blue-500 mb-2" />
            <p className="font-medium text-sm">الطلبات</p>
            <p className="text-xs text-gray-500 mt-1">مشتريات ومبيعات</p>
            <ChevronLeft className="h-4 w-4 text-gray-400 mt-2 group-hover:text-orange-500" />
          </Link>
          <Link href={`/business/${business.id}/inventory`} className="rounded-xl bg-white border p-4 hover:shadow-md transition-shadow group">
            <Warehouse className="h-7 w-7 text-indigo-500 mb-2" />
            <p className="font-medium text-sm">المخزون</p>
            <p className="text-xs text-gray-500 mt-1">مخزون الجملة</p>
            <ChevronLeft className="h-4 w-4 text-gray-400 mt-2 group-hover:text-orange-500" />
          </Link>
          <Link href={`/business/${business.id}/ledger`} className="rounded-xl bg-white border p-4 hover:shadow-md transition-shadow group">
            <BookOpen className="h-7 w-7 text-green-500 mb-2" />
            <p className="font-medium text-sm">الدفتر</p>
            <p className="text-xs text-gray-500 mt-1">الحسابات والديون</p>
            <ChevronLeft className="h-4 w-4 text-gray-400 mt-2 group-hover:text-orange-500" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-3">معلومات النشاط</h2>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500">الهاتف:</dt> <dd>{business.phone}</dd></div>
            {business.email && <div><dt className="text-gray-500">البريد:</dt> <dd>{business.email}</dd></div>}
            {business.address && <div><dt className="text-gray-500">العنوان:</dt> <dd>{business.address}</dd></div>}
            {business.commercialRegister && <div><dt className="text-gray-500">السجل التجاري:</dt> <dd>{business.commercialRegister}</dd></div>}
            {business.taxId && <div><dt className="text-gray-500">الرقم الضريبي:</dt> <dd>{business.taxId}</dd></div>}
            {business.verifiedAt && <div><dt className="text-gray-500">تاريخ التوثيق:</dt> <dd>{new Date(business.verifiedAt).toLocaleDateString("ar-MA")}</dd></div>}
          </dl>
        </div>

        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-3">الأعضاء</h2>
          <div className="space-y-2">
            {business.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{m.user.name}</p>
                  <p className="text-xs text-gray-500">{m.user.email}</p>
                </div>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {business.documents.length > 0 && (
        <div className="rounded-xl bg-white border p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-5 w-5" /> الوثائق</h2>
          <div className="space-y-2">
            {business.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{d.type}</p>
                  {d.notes && <p className="text-xs text-gray-500">{d.notes}</p>}
                </div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline text-xs">عرض</a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}