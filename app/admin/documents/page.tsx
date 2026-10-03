"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  FileText,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  AlertTriangle,
  ExternalLink,
  Store,
} from "lucide-react";

type Document = {
  id: number;
  type: string;
  typeLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  seller: {
    id: number;
    storeName: string;
    slug: string;
    isVerified: boolean;
    user: { name: string; email: string };
  };
};

const STATUS_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  PENDING: {
    label: "قيد المراجعة",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: Clock,
  },
  APPROVED: {
    label: "معتمدة",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "مرفوضة",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: XCircle,
  },
};

type Filter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Document | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/admin/documents?${params.toString()}`);
      const data = await res.json();
      if (data.success) setDocuments(data.documents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== "") loadData();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleApprove() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/documents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }

      setSelected(null);
      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    if (rejectionReason.trim().length < 3) {
      alert("اكتب سبب الرفض");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/documents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          rejectionReason: rejectionReason.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الإجراء");
        return;
      }

      setShowRejectModal(false);
      setSelected(null);
      setRejectionReason("");
      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionLoading(false);
    }
  }

  function formatSize(bytes: number) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">وثائق التجار</h1>
        <p className="mt-1 text-sm text-gray-500">
          مراجعة وثائق التجار للتحقق من متاجرهم
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالمتجر أو صاحب الحساب..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["PENDING", "قيد المراجعة"],
            ["APPROVED", "معتمدة"],
            ["REJECTED", "مرفوضة"],
            ["ALL", "الكل"],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition ${
              filter === f
                ? "bg-[#ff5c00] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <FileText className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا توجد وثائق</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "PENDING"
              ? "لا توجد وثائق بانتظار المراجعة"
              : "لا توجد وثائق بهذه الحالة"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const info = STATUS_INFO[doc.status];
            const Icon = info.icon;
            return (
              <div
                key={doc.id}
                className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${info.bg}`}
                  >
                    <FileText className={`h-6 w-6 ${info.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-gray-900">
                        {doc.typeLabel}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
                      <Store className="h-3 w-3" />
                      <Link
                        href={`/store/${doc.seller.slug}`}
                        target="_blank"
                        className="font-bold hover:text-[#ff5c00] hover:underline"
                      >
                        {doc.seller.storeName}
                      </Link>
                      <span>·</span>
                      <span>{doc.seller.user.name}</span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
                      <span>{formatSize(doc.sizeBytes)}</span>
                      <span>·</span>
                      <span>
                        {new Date(doc.createdAt).toLocaleDateString("ar-MA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelected(doc)}
                    className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e64a00]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    عرض
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Detail Modal ═══ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h3 className="text-lg font-black">مراجعة الوثيقة</h3>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Seller Info */}
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-lg font-black text-white">
                    {selected.seller.storeName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/store/${selected.seller.slug}`}
                        target="_blank"
                        className="text-sm font-black text-gray-900 hover:text-[#ff5c00]"
                      >
                        {selected.seller.storeName}
                      </Link>
                      {selected.seller.isVerified && (
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      {selected.seller.user.name} ·{" "}
                      {selected.seller.user.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Info */}
              <div className="space-y-2">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-[10px] font-bold text-gray-500">
                    نوع الوثيقة
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-900">
                    {selected.typeLabel}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="text-[10px] font-bold text-gray-500">
                    حالة المراجعة
                  </div>
                  <div
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_INFO[selected.status].bg} ${STATUS_INFO[selected.status].color}`}
                  >
                    {STATUS_INFO[selected.status].label}
                  </div>
                </div>
              </div>

              {/* File Preview Link */}
              <a
                href={selected.storageKey}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#ff5c00]/30 bg-[#fff4ed] p-4 transition hover:bg-[#ffe7d5]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white shadow-sm">
                    <FileText className="h-6 w-6 text-[#ff5c00]" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900">
                      فتح الملف للمراجعة
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">
                      {formatSize(selected.sizeBytes)} ·{" "}
                      {selected.mimeType.split("/")[1]?.toUpperCase() ||
                        "FILE"}
                    </div>
                  </div>
                </div>
                <ExternalLink className="h-5 w-5 text-[#ff5c00]" />
              </a>

              {/* Warning */}
              {selected.status === "PENDING" && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    ⚠️ افتح الملف وتأكد من صحته ومطابقته لاسم صاحب المتجر قبل
                    الموافقة.
                  </span>
                </div>
              )}

              {/* Actions */}
              {selected.status === "PENDING" && (
                <div className="flex gap-2 border-t border-gray-100 pt-4">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    موافقة
                  </button>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    رفض
                  </button>
                </div>
              )}

              {/* Already reviewed */}
              {selected.status !== "PENDING" && selected.reviewedAt && (
                <div
                  className={`rounded-lg border p-4 text-center ${
                    selected.status === "APPROVED"
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  {selected.status === "APPROVED" ? (
                    <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
                  ) : (
                    <XCircle className="mx-auto h-8 w-8 text-red-600" />
                  )}
                  <div
                    className={`mt-2 text-sm font-black ${
                      selected.status === "APPROVED"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {selected.status === "APPROVED"
                      ? "تم اعتماد الوثيقة"
                      : "تم رفض الوثيقة"}
                  </div>
                  {selected.rejectionReason && (
                    <div className="mt-2 text-xs text-red-600">
                      <strong>السبب:</strong> {selected.rejectionReason}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-gray-500">
                    بتاريخ{" "}
                    {new Date(selected.reviewedAt).toLocaleDateString("ar-MA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Reject Modal ═══ */}
      {showRejectModal && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-center text-lg font-black">
              رفض الوثيقة
            </h3>
            <p className="mt-2 text-center text-sm text-gray-600">
              اكتب سبب الرفض ليظهر للتاجر.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={actionLoading}
              placeholder="مثال: الصورة غير واضحة، أو الوثيقة منتهية الصلاحية..."
              className="mt-4 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
            />
            <div className="mt-1 text-left text-[10px] text-gray-400">
              {rejectionReason.length} / 500
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={handleReject}
                disabled={actionLoading || rejectionReason.trim().length < 3}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                تأكيد الرفض
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                disabled={actionLoading}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
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