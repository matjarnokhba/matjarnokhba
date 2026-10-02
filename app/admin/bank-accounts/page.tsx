"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Building2,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  AlertTriangle,
  Briefcase,
  User,
  Copy,
  Check,
  Store,
} from "lucide-react";

type BankAccount = {
  id: number;
  bankName: string;
  accountHolderMasked: string;
  ibanMasked: string;
  ribMasked: string | null;
  businessName: string | null;
  accountType: "PERSONAL" | "BUSINESS";
  currency: string;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verifiedAt: string | null;
  rejectionReason: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  seller: {
    id: number;
    storeName: string;
    slug: string;
    isVerified: boolean;
    user: { name: string; email: string };
  };
};

type AccountFull = BankAccount & {
  accountHolderFull: string | null;
  ibanFull: string | null;
  ribFull: string | null;
  seller: BankAccount["seller"] & {
    user: { name: string; email: string; phone: string | null };
  };
};

type Stats = {
  PENDING: number;
  VERIFIED: number;
  REJECTED: number;
  total: number;
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
  VERIFIED: {
    label: "موثّق",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "مرفوض",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: XCircle,
  },
};

type Filter = "PENDING" | "VERIFIED" | "REJECTED" | "ALL";

export default function AdminBankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [stats, setStats] = useState<Stats>({
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // ═══ Modal ═══
  const [selected, setSelected] = useState<AccountFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "ALL") params.set("status", filter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(
        `/api/admin/bank-accounts?${params.toString()}`
      );
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts);
        setStats(data.stats);
      }
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

  async function openDetail(accountId: number) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/bank-accounts/${accountId}`);
      const data = await res.json();
      if (data.success) {
        setSelected(data.account);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleApprove() {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/bank-accounts/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        }
      );
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
      const res = await fetch(
        `/api/admin/bank-accounts/${selected.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reject",
            rejectionReason: rejectionReason.trim(),
          }),
        }
      );
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

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // silent
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">
          الحسابات البنكية
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          مراجعة وتوثيق حسابات التجار البنكية
        </p>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          onClick={() => setFilter("PENDING")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "PENDING"
              ? "border-amber-500 bg-amber-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <Clock className="h-5 w-5 text-amber-600" />
          <div className="mt-2 text-2xl font-black text-amber-700">
            {stats.PENDING}
          </div>
          <div className="text-xs text-gray-600">بانتظار المراجعة</div>
        </button>

        <button
          onClick={() => setFilter("VERIFIED")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "VERIFIED"
              ? "border-green-500 bg-green-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div className="mt-2 text-2xl font-black text-green-700">
            {stats.VERIFIED}
          </div>
          <div className="text-xs text-gray-600">موثّقة</div>
        </button>

        <button
          onClick={() => setFilter("REJECTED")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "REJECTED"
              ? "border-red-500 bg-red-50"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <XCircle className="h-5 w-5 text-red-600" />
          <div className="mt-2 text-2xl font-black text-red-700">
            {stats.REJECTED}
          </div>
          <div className="text-xs text-gray-600">مرفوضة</div>
        </button>

        <button
          onClick={() => setFilter("ALL")}
          className={`rounded-xl border p-4 text-right shadow-sm transition ${
            filter === "ALL"
              ? "border-[#ff5c00] bg-[#fff4ed]"
              : "border-gray-100 bg-white hover:border-gray-200"
          }`}
        >
          <Building2 className="h-5 w-5 text-[#ff5c00]" />
          <div className="mt-2 text-2xl font-black text-gray-900">
            {stats.total}
          </div>
          <div className="text-xs text-gray-600">الإجمالي</div>
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالبنك، صاحب الحساب، أو اسم المتجر..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#ff5c00]"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <Building2 className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-5 text-lg font-black">لا توجد حسابات</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === "PENDING"
              ? "لا توجد حسابات بانتظار المراجعة"
              : "لا توجد حسابات بهذه الحالة"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const info = STATUS_INFO[account.verificationStatus];
            const Icon = info.icon;
            const TypeIcon =
              account.accountType === "BUSINESS" ? Briefcase : User;

            return (
              <div
                key={account.id}
                className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-4">
                  {/* Icon */}
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      account.isDefault
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    <Building2 className="h-6 w-6" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-gray-900">
                        {account.bankName}
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${info.bg} ${info.color}`}
                      >
                        <Icon className="h-3 w-3" />
                        {info.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <TypeIcon className="h-3 w-3" />
                        {account.accountType === "BUSINESS" ? "مهني" : "شخصي"}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-600">
                      <Store className="h-3 w-3" />
                      <Link
                        href={`/store/${account.seller.slug}`}
                        target="_blank"
                        className="font-bold hover:text-[#ff5c00] hover:underline"
                      >
                        {account.seller.storeName}
                      </Link>
                      <span>·</span>
                      <span>{account.seller.user.name}</span>
                    </div>

                    <div
                      className="mt-1 font-mono text-[10px] text-gray-500"
                      dir="ltr"
                    >
                      {account.ibanMasked}
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => openDetail(account.id)}
                    className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e64a00]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    مراجعة
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading detail */}
      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="rounded-2xl bg-white p-8">
            <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
          </div>
        </div>
      )}

      {/* ═══ Detail Modal ═══ */}
      {selected && !loadingDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h3 className="text-lg font-black">مراجعة الحساب البنكي</h3>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Store Info */}
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
                      {selected.seller.user.name} · {selected.seller.user.email}
                    </div>
                    {selected.seller.user.phone && (
                      <div className="mt-0.5 text-xs text-gray-500" dir="ltr">
                        {selected.seller.user.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  ⚠️ تحقق من أن اسم صاحب الحساب يطابق اسم صاحب المتجر قبل
                  الموافقة.
                </span>
              </div>

              {/* Data */}
              <div className="space-y-3">
                <DetailRow
                  label="نوع الحساب"
                  value={selected.accountType === "BUSINESS" ? "حساب مهني" : "حساب شخصي"}
                  icon={selected.accountType === "BUSINESS" ? Briefcase : User}
                />

                <DetailRow label="اسم البنك" value={selected.bankName} />

                {selected.businessName && (
                  <DetailRow
                    label="اسم صاحب النشاط"
                    value={selected.businessName}
                  />
                )}

                <DetailRow
                  label="اسم صاحب الحساب"
                  value={selected.accountHolderFull || "—"}
                  copyable
                  onCopy={() =>
                    selected.accountHolderFull &&
                    copyToClipboard(
                      selected.accountHolderFull,
                      "holder"
                    )
                  }
                  copied={copied === "holder"}
                  highlight
                />

                <DetailRow
                  label="IBAN الكامل"
                  value={selected.ibanFull || "—"}
                  mono
                  copyable
                  onCopy={() =>
                    selected.ibanFull &&
                    copyToClipboard(selected.ibanFull, "iban")
                  }
                  copied={copied === "iban"}
                  highlight
                />

                {selected.ribFull && (
                  <DetailRow
                    label="RIB الكامل"
                    value={selected.ribFull}
                    mono
                    copyable
                    onCopy={() =>
                      selected.ribFull &&
                      copyToClipboard(selected.ribFull, "rib")
                    }
                    copied={copied === "rib"}
                    highlight
                  />
                )}

                <DetailRow label="العملة" value={selected.currency} />
              </div>

              {/* Actions */}
              {selected.verificationStatus === "PENDING" && (
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
                    موافقة وتوثيق
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

              {selected.verificationStatus === "VERIFIED" && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
                  <div className="mt-2 text-sm font-black text-green-700">
                    هذا الحساب موثّق
                  </div>
                  {selected.verifiedAt && (
                    <div className="mt-1 text-xs text-green-600">
                      بتاريخ{" "}
                      {new Date(selected.verifiedAt).toLocaleDateString(
                        "ar-MA",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              {selected.verificationStatus === "REJECTED" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <XCircle className="mx-auto h-8 w-8 text-red-600" />
                  <div className="mt-2 text-center text-sm font-black text-red-700">
                    هذا الحساب مرفوض
                  </div>
                  {selected.rejectionReason && (
                    <div className="mt-2 text-xs text-red-600">
                      <strong>السبب:</strong> {selected.rejectionReason}
                    </div>
                  )}
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
              رفض الحساب البنكي
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
              placeholder="مثال: اسم صاحب الحساب لا يطابق اسم المتجر، أو IBAN غير صحيح..."
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

// ═══ Detail Row ═══
function DetailRow({
  label,
  value,
  mono = false,
  highlight = false,
  copyable = false,
  onCopy,
  copied = false,
  icon: Icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  copyable?: boolean;
  onCopy?: () => void;
  copied?: boolean;
  icon?: any;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
        highlight
          ? "border-[#ff5c00]/30 bg-[#fff4ed]"
          : "border-gray-100 bg-gray-50"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
          {Icon && <Icon className="h-3 w-3" />}
          {label}
        </div>
        <div
          className={`mt-1 break-all text-sm font-bold text-gray-900 ${
            mono ? "font-mono text-xs" : ""
          }`}
          dir={mono ? "ltr" : "rtl"}
        >
          {value}
        </div>
      </div>

      {copyable && (
        <button
          onClick={onCopy}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white hover:text-[#ff5c00]"
          aria-label="نسخ"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}