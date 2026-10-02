"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Shield,
  Star,
  Power,
  Clock,
  XCircle,
  Briefcase,
  User,
} from "lucide-react";

type BankAccount = {
  id: number;
  bankName: string;
  accountHolderMasked: string;
  ibanMasked: string;
  ibanLast4: string;
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
};

const VERIFICATION_INFO: Record<
  string,
  { label: string; color: string; bg: string; icon: any }
> = {
  PENDING: {
    label: "قيد التحقق",
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

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(
    null
  );

  // ═══ Form State ═══
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [accountType, setAccountType] = useState<"PERSONAL" | "BUSINESS">(
    "PERSONAL"
  );
  const [iban, setIban] = useState("");
  const [rib, setRib] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/seller/bank-accounts");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setAccounts(data.accounts);
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
    setBankName("");
    setAccountHolder("");
    setBusinessName("");
    setAccountType("PERSONAL");
    setIban("");
    setRib("");
    setFormError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (bankName.trim().length < 2) {
      setFormError("اسم البنك مطلوب");
      return;
    }
    if (accountHolder.trim().length < 3) {
      setFormError("اسم صاحب الحساب مطلوب");
      return;
    }
    const cleanIban = iban.trim().replace(/\s/g, "");
    if (cleanIban.length < 15 || cleanIban.length > 34) {
      setFormError("IBAN غير صحيح (15-34 حرف)");
      return;
    }
    if (!/^[A-Z0-9]+$/i.test(cleanIban)) {
      setFormError("IBAN يجب أن يحتوي حروفاً إنجليزية وأرقاماً فقط");
      return;
    }
    const cleanRib = rib.trim().replace(/\s/g, "");
    if (cleanRib && !/^[0-9]{20,24}$/.test(cleanRib)) {
      setFormError("RIB يجب أن يكون 20-24 رقماً");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/seller/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: bankName.trim(),
          accountHolder: accountHolder.trim(),
          businessName: businessName.trim() || undefined,
          accountType,
          iban: cleanIban.toUpperCase(),
          rib: cleanRib || undefined,
          currency: "MAD",
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || "فشل الحفظ");
        return;
      }

      setSuccessMsg("تمت إضافة الحساب بنجاح — بانتظار التحقق");
      setShowAddForm(false);
      resetForm();
      await loadData();
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      setFormError("فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(accountId: number) {
    setActionId(accountId);
    try {
      const res = await fetch(`/api/seller/bank-accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_default" }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل التحديث");
        return;
      }

      setSuccessMsg("تم تعيين الحساب كافتراضي");
      await loadData();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionId(null);
    }
  }

  async function handleDeactivate(accountId: number) {
    if (!confirm("هل تريد تعطيل هذا الحساب؟")) return;

    setActionId(accountId);
    try {
      const res = await fetch(`/api/seller/bank-accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deactivate" }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "فشل التعطيل");
        return;
      }

      await loadData();
    } catch {
      alert("فشل الاتصال");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(accountId: number) {
    setActionId(accountId);
    try {
      const res = await fetch(`/api/seller/bank-accounts/${accountId}`, {
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
          <h1 className="text-2xl font-black text-gray-900">
            الحسابات البنكية
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            الحسابات التي ستستقبل فيها أرباحك
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" />
          إضافة حساب
        </button>
      </div>

      {/* Warning */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-black text-blue-900">🔒 بياناتك محمية</div>
          <div className="mt-1 text-xs text-blue-700 leading-6">
            يتم تشفير IBAN و RIB باستخدام AES-256-GCM قبل حفظها في قاعدة
            البيانات. لا يمكن قراءتها إلا بعد التحقق من الإدارة.
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
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && accounts.length === 0 && (
        <div className="rounded-xl bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
            <Building2 className="h-10 w-10 text-[#ff5c00]" />
          </div>
          <h2 className="mt-5 text-lg font-black">لا توجد حسابات بنكية</h2>
          <p className="mt-2 text-sm text-gray-500">
            أضف حسابك البنكي الأول لاستقبال أرباحك
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة حساب بنكي
          </button>
        </div>
      )}

      {/* List */}
      {!loading && !error && accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => {
            const verInfo = VERIFICATION_INFO[account.verificationStatus];
            const VerIcon = verInfo.icon;
            const TypeIcon =
              account.accountType === "BUSINESS" ? Briefcase : User;
            const typeLabel =
              account.accountType === "BUSINESS" ? "حساب مهني" : "حساب شخصي";

            return (
              <div
                key={account.id}
                className={`overflow-hidden rounded-xl bg-white shadow-sm transition ${
                  !account.isActive ? "opacity-60" : ""
                }`}
              >
                {/* رأس البطاقة */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        account.isDefault
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      <CreditCard className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-gray-900">
                          {account.bankName}
                        </span>
                        {account.isDefault && (
                          <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                            <Star className="h-3 w-3 fill-current" />
                            افتراضي
                          </span>
                        )}
                        {!account.isActive && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                            معطّل
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
                        <TypeIcon className="h-3 w-3" />
                        {typeLabel}
                        {account.businessName && (
                          <>
                            <span>·</span>
                            <span>{account.businessName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* حالة التحقق */}
                  <span
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${verInfo.bg} ${verInfo.color}`}
                  >
                    <VerIcon className="h-3.5 w-3.5" />
                    {verInfo.label}
                  </span>
                </div>

                {/* تفاصيل الحساب */}
                <div className="grid gap-3 p-4 sm:grid-cols-3">
                  <Detail label="اسم صاحب الحساب" value={account.accountHolderMasked} />
                  <Detail
                    label="IBAN"
                    value={account.ibanMasked}
                    mono
                  />
                  <Detail
                    label="RIB"
                    value={account.ribMasked || "—"}
                    mono
                  />
                </div>

                {/* رفض */}
                {account.verificationStatus === "REJECTED" &&
                  account.rejectionReason && (
                    <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <strong>سبب الرفض:</strong> {account.rejectionReason}
                    </div>
                  )}

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span>
                      أُضيف في{" "}
                      {new Date(account.createdAt).toLocaleDateString("ar-MA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span>·</span>
                    <span className="font-bold text-gray-700">
                      {account.currency}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {account.isActive && !account.isDefault && (
                      <button
                        onClick={() => handleSetDefault(account.id)}
                        disabled={actionId === account.id}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                      >
                        {actionId === account.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Star className="h-3 w-3" />
                        )}
                        تعيين افتراضي
                      </button>
                    )}

                    {account.isActive && !account.isDefault && (
                      <button
                        onClick={() => handleDeactivate(account.id)}
                        disabled={actionId === account.id}
                        className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                      >
                        <Power className="h-3 w-3" />
                        تعطيل
                      </button>
                    )}

                    {!account.isDefault && (
                      <button
                        onClick={() => setShowDeleteConfirm(account.id)}
                        disabled={actionId === account.id}
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Add Modal ═══ */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => {
            if (!saving) {
              setShowAddForm(false);
              resetForm();
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <h3 className="text-lg font-black">إضافة حساب بنكي</h3>
              <button
                onClick={() => {
                  if (!saving) {
                    setShowAddForm(false);
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
              {/* نوع الحساب */}
              <div>
                <label className="mb-2 block text-xs font-bold text-gray-700">
                  نوع الحساب <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountType("PERSONAL")}
                    disabled={saving}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-xs font-bold transition ${
                      accountType === "PERSONAL"
                        ? "border-[#ff5c00] bg-[#fff4ed] text-[#ff5c00]"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <User className="h-4 w-4" />
                    حساب شخصي
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType("BUSINESS")}
                    disabled={saving}
                    className={`flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-xs font-bold transition ${
                      accountType === "BUSINESS"
                        ? "border-[#ff5c00] bg-[#fff4ed] text-[#ff5c00]"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <Briefcase className="h-4 w-4" />
                    حساب مهني
                  </button>
                </div>
              </div>

              {/* Bank Name */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  اسم البنك <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="مثال: CIH Bank"
                  maxLength={80}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                  required
                />
              </div>

              {/* Account Holder */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  اسم صاحب الحساب <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="محمد العلوي"
                  maxLength={120}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                  required
                />
              </div>

              {/* Business Name (للحسابات المهنية فقط) */}
              {accountType === "BUSINESS" && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    اسم صاحب النشاط
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="اسم الشركة / التجارة"
                    maxLength={120}
                    disabled={saving}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                  />
                </div>
              )}

              {/* RIB */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  RIB <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={rib}
                  onChange={(e) =>
                    setRib(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="24 رقماً"
                  dir="ltr"
                  maxLength={24}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                  required
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  {rib.length} / 24 رقماً
                </p>
              </div>

              {/* IBAN */}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  IBAN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  placeholder="MA64 XXXX XXXX XXXX XXXX XXXX XXXX"
                  dir="ltr"
                  maxLength={34}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white disabled:opacity-50"
                  required
                />
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  سيتم تشفير بياناتك فوراً. الحساب بانتظار التحقق من الإدارة
                  قبل تفعيله.
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
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-3 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  إضافة الحساب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
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
              سيتم حذف هذا الحساب البنكي نهائياً.
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

// ═══ Detail Component ═══
function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-bold text-gray-500">{label}</div>
      <div
        className={`mt-0.5 truncate text-xs font-bold text-gray-900 ${
          mono ? "font-mono" : ""
        }`}
        dir={mono ? "ltr" : "rtl"}
      >
        {value}
      </div>
    </div>
  );
}