"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Search,
  Plus,
  Building2,
  User,
  Phone,
  Mail,
  ArrowLeft,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/lib/hooks/useToast";
import { formatMoney, BU_TYPE_LABEL } from "@/components/wholesale/offers/types";
import {
  CONTACT_TYPE_LABEL,
  CONTACT_TYPE_VARIANT,
  formatBalance,
  type BUOption,
  type LedgerContactItem,
  type LedgerSummary,
} from "./types";

export interface LedgerContentProps {
  businessUnits: BUOption[];
  initialBusinessUnitId: number;
}

const CONTACT_TYPE_OPTIONS = [
  { value: "", label: "كل الأنواع" },
  { value: "PLATFORM_TRADER", label: CONTACT_TYPE_LABEL.PLATFORM_TRADER },
  { value: "EXTERNAL", label: CONTACT_TYPE_LABEL.EXTERNAL },
  { value: "EMPLOYEE", label: CONTACT_TYPE_LABEL.EMPLOYEE },
  { value: "SUPPLIER", label: CONTACT_TYPE_LABEL.SUPPLIER },
];

const BALANCE_OPTIONS = [
  { value: "", label: "كل الأرصدة" },
  { value: "positive", label: "مدينون لنا" },
  { value: "negative", label: "مدينون لهم" },
  { value: "zero", label: "مسددون" },
];

export function LedgerContent({
  businessUnits,
  initialBusinessUnitId,
}: LedgerContentProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [buId, setBuId] = useState(String(initialBusinessUnitId));
  const [search, setSearch] = useState("");
  const [contactType, setContactType] = useState("");
  const [hasBalance, setHasBalance] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LedgerContactItem[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>({
    totalContacts: 0,
    netBalance: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 30,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("EXTERNAL");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newOpening, setNewOpening] = useState("0");
  const [newNotes, setNewNotes] = useState("");

  const load = useCallback(async () => {
    if (!buId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (contactType) params.set("contactType", contactType);
      if (hasBalance) params.set("hasBalance", hasBalance);
      params.set("page", String(page));
      const res = await fetch(
        `/api/wholesale/business-units/${buId}/ledger/contacts?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setItems(data.items ?? []);
      setSummary(
        data.summary ?? { totalContacts: 0, netBalance: 0 }
      );
      setPagination(data);
    } catch {
      setError("خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  }, [buId, search, contactType, hasBalance, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleBUChange = (newBUId: string) => {
    setBuId(newBUId);
    setPage(1);
    router.push(`/wholesale/ledger?businessUnitId=${newBUId}`);
  };

  const handleCreate = async () => {
    if (!buId) return;
    if (newName.trim().length < 2) {
      toast("اسم الطرف مطلوب (حرفان على الأقل)", "warning");
      return;
    }
    const opening = parseFloat(newOpening) || 0;

    setCreating(true);
    try {
      const res = await fetch(
        `/api/wholesale/business-units/${buId}/ledger/contacts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            name: newName.trim(),
            contactType: newType,
            phone: newPhone.trim() || null,
            email: newEmail.trim() || null,
            openingBalance: opening,
            notes: newNotes.trim() || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إنشاء الطرف", "error");
        return;
      }
      toast("تم إنشاء الطرف بنجاح", "success");
      setCreateOpen(false);
      setNewName("");
      setNewType("EXTERNAL");
      setNewPhone("");
      setNewEmail("");
      setNewOpening("0");
      setNewNotes("");
      await load();
    } catch {
      toast("خطأ في الاتصال", "error");
    } finally {
      setCreating(false);
    }
  };

  if (businessUnits.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="دفتر الديون" description="إدارة حسابات الأشخاص والجهات" />
        <Empty
          icon={BookOpen}
          title="لا توجد أنشطة تجارية"
          description="أنشئ نشاطًا تجاريًا أولًا لفتح دفتر الديون."
          action={
            <Link href="/wholesale/business-units/new">
              <Button>إنشاء نشاط</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const buOptions = businessUnits.map((b) => ({
    value: String(b.id),
    label: `${b.name} (${BU_TYPE_LABEL[b.type] ?? b.type})`,
  }));

  const net = formatBalance(summary.netBalance);

  return (
    <div className="space-y-5">
      <PageHeader
        title="دفتر الديون"
        description="تتبّع علاقاتك المالية مع الأشخاص والجهات (داخل وخارج المنصة)"
        action={
          <Button
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
          >
            طرف جديد
          </Button>
        }
      />

      {/* BU selector */}
      <Card padding="sm">
        <div className="sm:max-w-md">
          <Select
            label="النشاط"
            value={buId}
            onChange={(e) => handleBUChange(e.target.value)}
            options={buOptions}
          />
        </div>
      </Card>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500">إجمالي الأطراف</p>
              <p className="mt-1 text-2xl font-black text-gray-900">
                {summary.totalContacts}
              </p>
            </div>
            <User className="h-5 w-5 text-gray-400" />
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500">صافي الرصيد</p>
              <p className={`mt-1 text-2xl font-black ${net.color}`}>
                {net.text} د.م
              </p>
              <Badge variant={net.badgeVariant} size="sm">
                {net.label}
              </Badge>
            </div>
            {summary.netBalance >= 0 ? (
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              البحث
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="الاسم، الهاتف، البريد"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setPage(1);
                    load();
                  }
                }}
                fullWidth
              />
              <Button
                variant="secondary"
                onClick={() => {
                  setPage(1);
                  load();
                }}
                iconLeft={<Search className="h-4 w-4" />}
              >
                بحث
              </Button>
            </div>
          </div>
          <div className="sm:w-48">
            <Select
              label="النوع"
              value={contactType}
              onChange={(e) => {
                setContactType(e.target.value);
                setPage(1);
              }}
              options={CONTACT_TYPE_OPTIONS}
            />
          </div>
          <div className="sm:w-44">
            <Select
              label="الرصيد"
              value={hasBalance}
              onChange={(e) => {
                setHasBalance(e.target.value);
                setPage(1);
              }}
              options={BALANCE_OPTIONS}
            />
          </div>
        </div>
      </Card>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
        </div>
      )}

      {error && !loading && (
        <Card>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="inline h-4 w-4" /> {error}
          </div>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Empty
          icon={BookOpen}
          title="لا توجد أطراف بعد"
          description="أضف طرفًا (تاجر، مورد، موظف، أو شخص) لبدء تسجيل التعاملات المالية."
          action={
            <Button
              iconLeft={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              إضافة طرف
            </Button>
          }
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="space-y-2">
            {items.map((item) => {
              const bal = formatBalance(item.currentBalance);
              const TypeIcon = item.contactType === "EMPLOYEE" ? User : Building2;
              return (
                <Link
                  key={item.id}
                  href={`/wholesale/ledger/${item.id}?businessUnitId=${buId}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50">
                          <TypeIcon className="h-5 w-5 text-[#ff5c00]" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-gray-900">
                              {item.name}
                            </p>
                            <Badge
                              variant={
                                CONTACT_TYPE_VARIANT[item.contactType] ?? "gray"
                              }
                              size="sm"
                            >
                              {CONTACT_TYPE_LABEL[item.contactType] ??
                                item.contactType}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {item.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {item.phone}
                              </span>
                            )}
                            {item.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {item.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-lg font-black ${bal.color}`}>
                            {bal.text}
                          </p>
                          <Badge variant={bal.badgeVariant} size="sm">
                            {bal.label}
                          </Badge>
                        </div>
                        <ArrowLeft className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="طرف جديد في الدفتر"
        description="أضف شخصًا أو جهة لتتبع التعاملات المالية معه"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              إلغاء
            </Button>
            <Button onClick={handleCreate} loading={creating}>
              إضافة الطرف
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="الاسم"
            placeholder="مثال: أحمد التاجر"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={200}
            required
          />
          <Select
            label="نوع الطرف"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            options={[
              { value: "EXTERNAL", label: CONTACT_TYPE_LABEL.EXTERNAL },
              { value: "SUPPLIER", label: CONTACT_TYPE_LABEL.SUPPLIER },
              { value: "EMPLOYEE", label: CONTACT_TYPE_LABEL.EMPLOYEE },
              {
                value: "PLATFORM_TRADER",
                label: CONTACT_TYPE_LABEL.PLATFORM_TRADER,
              },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="الهاتف (اختياري)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              maxLength={30}
            />
            <Input
              label="البريد (اختياري)"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              maxLength={200}
            />
          </div>
          <Input
            label="الرصيد الافتتاحي (د.م)"
            type="number"
            value={newOpening}
            onChange={(e) => setNewOpening(e.target.value)}
            hint="موجب = مدين لنا · سالب = مدينون له"
          />
          <Textarea
            label="ملاحظات (اختياري)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            rows={2}
            maxLength={2000}
          />
        </div>
      </Dialog>
    </div>
  );
}