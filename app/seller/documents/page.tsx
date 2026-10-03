"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  X,
  Shield,
  Upload as UploadIcon,
} from "lucide-react";
import DocumentUploader from "@/components/seller/DocumentUploader";

type DocumentType =
  | "CIN"
  | "PASSPORT"
  | "ICE"
  | "RC"
  | "IF"
  | "BANK_STATEMENT"
  | "ADDRESS_PROOF"
  | "OTHER";

type SellerDocument = {
  id: number;
  type: DocumentType;
  typeLabel: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
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

const DOC_TYPES: { value: DocumentType; label: string; hint: string }[] = [
  { value: "CIN", label: "بطاقة التعريف الوطنية", hint: "الوجه والظهر" },
  { value: "ICE", label: "السجل التجاري (ICE)", hint: "9 أرقام" },
  { value: "RC", label: "البطاقة التجارية (RC)", hint: "للتجار المسجّلين" },
  { value: "IF", label: "المعرف الجبائي (IF)", hint: "للتجار المسجّلين" },
  {
    value: "BANK_STATEMENT",
    label: "كشف حساب بنكي",
    hint: "آخر 3 أشهر",
  },
  {
    value: "ADDRESS_PROOF",
    label: "إثبات العنوان",
    hint: "فاتورة كهرباء/ماء",
  },
  { value: "OTHER", label: "وثيقة أخرى", hint: "اختياري" },
];

export default function SellerDocumentsPage() {
  const [documents, setDocuments] = useState<SellerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType>("CIN");
  const [notes, setNotes] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadedData, setUploadedData] = useState<{
    name: string;
    size: number;
    mimeType: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(
    null
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/seller/documents");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setDocuments(data.documents);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setSelectedType("CIN");
    setNotes("");
    setUploadedUrl(null);
    setUploadedData(null);
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!uploadedUrl || !uploadedData) {
      setFormError("ارفع الملف أولاً");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/seller/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          storageKey: uploadedUrl,
          mimeType: uploadedData.mimeType,
          sizeBytes: uploadedData.size,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || "فشل الحفظ");
        return;
      }

      setSuccessMsg("تم رفع الوثيقة — بانتظار المراجعة");
      setShowUploadModal(false);
      resetForm();
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      setFormError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(docId: number) {
    setActionId(docId);
    try {
      const res = await fetch(`/api/seller/documents/${docId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل الحذف");
        return;
      }

      setShowDeleteConfirm(null);
      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">وثائقي</h1>
          <p className="mt-1 text-sm text-gray-500">
            ارفع وثائقك للتحقق من متجرك
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowUploadModal(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          رفع وثيقة
        </button>
      </div>

      {/* Info */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-black text-blue-900">🔒 وثائقك محمية</div>
          <div className="mt-1 text-xs leading-6 text-blue-700">
            يتم تخزين وثائقك بشكل آمن ولا يمكن الوصول إليها إلا من قبلك وقبل
            الإدارة للمراجعة. التحقق من الوثائق يزيد من موثوقية متجرك لدى
            العملاء.
          </div>
        </div>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
          <h2 className="mt-3 text-base font-black">{error}</h2>
          <button
            onClick={loadData}
            className="mt-4 rounded-full bg-[#ff5c00] px-6 py-2 text-xs font-bold text-white"
          >
            إعادةUpload المحاولة
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && documents.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-centerTh justify-center rounded-full bg-oringange-100">
            <FileText className="h-10 w-10 text-[#ff5c00]" />
          </div>
          <h2 className="mt-5 text-lg font-black">لا توجد وثائق بعد</h2>
          <p className="mt-2 text-sm text-gray-500">
            ارفع وثائقك للتحقق من متجرك
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            رفع أول وثيقة
          </button>
        </div>
      )}

      {/* List */}
      {!loading && !error && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map((doc) => {
            const info = STATUS_INFO[doc.status];
            const Icon = info.icon;
            return (
              <div key={doc.id} className="rounded-xl bg-white p-4 shadow-sm">
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
                    <div className="mt-1 text-[11px] text-gray-500">
                      {(doc.sizeBytes / 1024).toFixed(0)} KB ·{" "}
                      {new Date(doc.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    {doc.status === "REJECTED" && doc.rejectionReason && (
                      <div className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700">
                        <strong>سبب الرفض:</strong> {doc.rejectionReason}
                      </div>
                    )}
                  </div>

                  {doc.status !== "APPROVED" && (
                    <button
                      onClick={() => setShowDeleteConfirm(doc.id)}
                      disabled={actionId === doc.id}
                      className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Upload Modal ═══ */}
      {showUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => {
            if (!saving) {
              setShowUploadModal(false);
              resetForm();
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h3 className="text-lg font-black">رفع وثيقة</h3>
              <button
                onClick={() => {
                  if (!saving) {
                    setShowUploadModal(false);
                    resetForm();
                  }
                }}
                disabled={saving}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {/* Type */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  نوع الوثيقة <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedType}
                  onChange={(e) =>
                    setSelectedType(e.target.value as DocumentType)
                  }
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} — {t.hint}
                    </option>
                  ))}
                </select>
              </div>

              {/* Uploader */}
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-700">
                  الملف <span className="text-red-500">*</span>
                </label>
                {!uploadedUrl ? (
                  <DocumentUploader
                    accept="both"
                    disabled={saving}
                    onSuccess={(data) => {
                      setUploadedUrl(data.url);
                      setUploadedData({
                        name: data.name,
                        size: data.size,
                        mimeType: data.mimeType,
                      });
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border-2 border-green-500 bg-green-50 p-4">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-green-800">
                        {uploadedData?.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-green-700">
                        {((uploadedData?.size || 0) / 1024).toFixed(0)} KB ·
                        تم الرفع
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedUrl(null);
                        setUploadedData(null);
                      }}
                      disabled={saving}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-green-700 hover:bg-green-100 disabled:opacity-50"
                      aria-label="إزالة"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  ملاحظات <span className="text-gray-400">(اختياري)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  disabled={saving}
                  placeholder="أي معلومات إضافية..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                <UploadIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  سيتم مراجعة وثيقتك من الإدارة. لا يمكنك رفع نفس النوع
                  مجدداً حتى يتم الرد.
                </span>
              </div>

              {/* Error */}
              {formError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving || !uploadedUrl}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  رفع الوثيقة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 px-5 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirm ═══ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-7 w-7 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-black">تأكيد الحذف</h3>
            <p className="mt-2 text-sm text-gray-600">
              سيتم حذف هذه الوثيقة نهائياً.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={actionId === showDeleteConfirm}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 py-2.5 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {actionId === showDeleteConfirm ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                نعم، احذف
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={actionId === showDeleteConfirm}
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