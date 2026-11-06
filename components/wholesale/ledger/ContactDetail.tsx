"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Loader2,
  Phone,
  Mail,
  Trash2,
  AlertCircle,
  User,
  Building2,
  Calendar,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Dialog } from "@/components/ui/Dialog";
import { Empty } from "@/components/ui/Empty";
import { useToast } from "@/lib/hooks/useToast";
import { formatMoney, formatDate, formatDateTime } from "@/components/wholesale/offers/types";
import {
  CONTACT_TYPE_LABEL,
  CONTACT_TYPE_VARIANT,
  ENTRY_TYPE_LABEL,
  ENTRY_TYPE_VARIANT,
  formatBalance,
  type LedgerContactDetail,
  type LedgerEntry,
} from "./types";

export interface ContactDetailProps {
  businessUnitId: number;
  contact: LedgerContactDetail;
  initialEntries: LedgerEntry[];
}

export function ContactDetail({
  businessUnitId,
  contact,
  initialEntries,
}: ContactDetailProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<LedgerEntry[]>(initialEntries);
  const [currentBalance, setCurrentBalance] = useState(
    contact.currentBalance
  );
  const [entryOpen, setEntryOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Add entry form
  const [entryType, setEntryType] = useState<"GAVE" | "TOOK" | "SETTLEMENT">(
    "GAVE"
  );
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDescription, setEntryDescription] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnitId}/ledger/contacts/${contact.id}?entryLimit=200`
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setEntries(data.entries ?? []);
        setCurrentBalance(data.contact?.currentBalance ?? 0);
      }
    } catch {}
  }, [businessUnitId, contact.id]);

  const handleAddEntry = async () => {
    if (adding) return;

    const amount = parseFloat(entryAmount);
    if (isNaN(amount) || amount === 0) {
      toast("المبلغ يجب أن يكون رقمًا غير صفري", "warning");
      return;
    }

    if (entryType !== "SETTLEMENT" && amount < 0) {
      toast("المبلغ موجب لهذا النوع", "warning");
      return;
    }

    if (entryDescription.trim().length < 3) {
      toast("الوصف مطلوب (3 أحرف على الأقل)", "warning");
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnitId}/ledger/contacts/${contact.id}/entries`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            type: entryType,
            amount,
            description: entryDescription.trim(),
            entryDate: entryDate
              ? new Date(entryDate).toISOString()
              : undefined,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل تسجيل القيد", "error");
        return;
      }

      toast("تم تسجيل القيد بنجاح", "success");
      setEntryOpen(false);
      setEntryAmount("");
      setEntryDescription("");
      setEntryDate(new Date().toISOString().slice(0, 10));
      await load();
    } catch {
      toast("خطأ في الاتصال", "error");
    } finally {
      setAdding(false);
    }
  };

  const bal = formatBalance(currentBalance);
  const TypeIcon = contact.contactType === "EMPLOYEE" ? User : Building2;

  return (
    <div className="space-y-5">
      <Link
        href={`/wholesale/ledger?businessUnitId=${businessUnitId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-4 w-4" />
        العودة لدفتر الديون
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <TypeIcon className="h-5 w-5 text-gray-400" />
            {contact.name}
            <Badge
              variant={CONTACT_TYPE_VARIANT[contact.contactType] ?? "gray"}
            >
              {CONTACT_TYPE_LABEL[contact.contactType] ?? contact.contactType}
            </Badge>
          </span>
        }
        description={
          contact.phone || contact.email
            ? [contact.phone, contact.email].filter(Boolean).join(" · ")
            : "لا توجد بيانات اتصال"
        }
        action={
          <Button
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => setEntryOpen(true)}
          >
            قيد جديد
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Entries timeline */}
          <Card padding="none">
            <div className="border-b border-gray-100 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <ArrowLeftRight className="h-4 w-4 text-gray-400" />
                القيود ({entries.length})
              </h3>
            </div>
            {entries.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">
                  لا توجد قيود بعد — أضف أول قيد
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <div key={e.id} className="p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={ENTRY_TYPE_VARIANT[e.type] ?? "gray"}
                            size="sm"
                          >
                            {ENTRY_TYPE_LABEL[e.type] ?? e.type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(e.entryDate)}
                          </span>
                          {e.referenceType && e.referenceType !== "MANUAL" && (
                            <Badge variant="gray" size="sm">
                              {e.referenceType}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-900">
                          {e.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-base font-bold ${
                            e.type === "GAVE"
                              ? "text-emerald-700"
                              : e.type === "TOOK"
                              ? "text-red-600"
                              : "text-gray-700"
                          }`}
                        >
                          {e.type === "GAVE" ? "+" : e.type === "TOOK" ? "−" : ""}
                          {formatMoney(Math.abs(e.amount))} د.م
                        </p>
                        <p className="text-[10px] text-gray-500">
                          رصيد: {formatMoney(e.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Balance card */}
          <Card>
            <div className="text-center">
              <p className="text-xs text-gray-500">الرصيد الحالي</p>
              <p className={`mt-2 text-3xl font-black ${bal.color}`}>
                {bal.text}
              </p>
              <p className="text-xs text-gray-500">د.م</p>
              <Badge variant={bal.badgeVariant} className="mt-2">
                {bal.label}
              </Badge>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">الرصيد الافتتاحي</span>
                <span className="font-medium text-gray-900">
                  {formatMoney(contact.openingBalance)} د.م
                </span>
              </div>
            </div>
          </Card>

          {/* Contact info */}
          <Card>
            <h3 className="mb-2 text-sm font-bold text-gray-900">المعلومات</h3>
            <dl className="space-y-2 text-xs">
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-700">{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-700">{contact.email}</span>
                </div>
              )}
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-gray-500">
                  أُضيف {formatDate(contact.createdAt)}
                </span>
              </div>
              {contact.notes && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-gray-500">ملاحظات</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-gray-700">
                    {contact.notes}
                  </p>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>

      {/* Add entry dialog */}
      <Dialog
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        title="قيد مالي جديد"
        description={`الرصيد الحالي: ${bal.text} د.م (${bal.label})`}
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setEntryOpen(false)}
              disabled={adding}
            >
              إلغاء
            </Button>
            <Button onClick={handleAddEntry} loading={adding}>
              حفظ القيد
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Type selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              نوع القيد
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { v: "GAVE" as const, l: "أعطيته", c: "emerald" },
                  { v: "TOOK" as const, l: "أخذت منه", c: "red" },
                  { v: "SETTLEMENT" as const, l: "تسوية", c: "gray" },
                ] as const
              ).map((opt) => {
                const selected = entryType === opt.v;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setEntryType(opt.v)}
                    className={`rounded-lg border-2 p-2 text-xs font-semibold transition-all ${
                      selected
                        ? opt.c === "emerald"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : opt.c === "red"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-gray-500 bg-gray-100 text-gray-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.l}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="المبلغ (د.م)"
            type="number"
            step="0.01"
            value={entryAmount}
            onChange={(e) => setEntryAmount(e.target.value)}
            required
            hint={
              entryType === "GAVE"
                ? "موجب — يزيد رصيده المدين لنا"
                : entryType === "TOOK"
                ? "موجب — ينقص رصيده المدين لنا"
                : "موجب = زيادة · سالب = نقصان"
            }
          />

          <Input
            label="التاريخ"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />

          <Textarea
            label="الوصف"
            placeholder="مثال: دفعة نقدية · فاتورة مبيعات · سداد جزئي"
            value={entryDescription}
            onChange={(e) => setEntryDescription(e.target.value)}
            rows={2}
            maxLength={500}
            required
          />
        </div>
      </Dialog>
    </div>
  );
}