"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  UserCog,
  Search,
  UserPlus,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Empty } from "@/components/ui/Empty";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/lib/hooks/useToast";
import { ROLE_LABEL, type SerializableMember } from "./types";

const ROLE_VARIANT: Record<string, "orange" | "blue" | "gray"> = {
  OWNER: "orange",
  MANAGER: "blue",
  STAFF: "gray",
};

const PERMISSIONS_OPTIONS = [
  { value: "products.read", label: "قراءة المنتجات" },
  { value: "products.write", label: "إدارة المنتجات" },
  { value: "offers.read", label: "قراءة العروض" },
  { value: "offers.write", label: "إدارة العروض" },
  { value: "orders.read", label: "قراءة الطلبات" },
  { value: "orders.write", label: "إدارة الطلبات" },
  { value: "inventory.read", label: "قراءة المخزون" },
  { value: "inventory.adjust", label: "تعديل المخزون" },
  { value: "returns.read", label: "قراءة المرتجعات" },
  { value: "returns.write", label: "إدارة المرتجعات" },
  { value: "ledger.read", label: "قراءة المالية" },
];

export interface MembersTabProps {
  businessUnitId: number;
  isOwner: boolean;
  currentUserId: number;
  members: SerializableMember[];
  onMembersChange: (members: SerializableMember[]) => void;
}

type FoundUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
};

export function MembersTab({
  businessUnitId,
  isOwner,
  currentUserId,
  members,
  onMembersChange,
}: MembersTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [role, setRole] = useState<"MANAGER" | "STAFF">("STAFF");
  const [permissions, setPermissions] = useState<string[]>([
    "products.read",
    "orders.read",
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const resetDialog = () => {
    setSearchQuery("");
    setFoundUser(null);
    setRole("STAFF");
    setPermissions(["products.read", "orders.read"]);
  };

  const handleSearch = async () => {
    if (searchQuery.trim().length < 3) {
      toast("أدخل 3 أحرف على الأقل", "warning");
      return;
    }
    setSearching(true);
    setFoundUser(null);
    try {
      const res = await fetch(
        `/api/wholesale/users/search?q=${encodeURIComponent(
          searchQuery.trim()
        )}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل البحث", "error");
        return;
      }
      if (!data.user) {
        toast("لم يتم العثور على مستخدم بالبريد أو الهاتف المدخل", "warning");
        return;
      }
      const existing = members.find((m) => m.userId === data.user.id);
      if (existing && existing.isActive) {
        toast("هذا المستخدم عضو بالفعل في هذا النشاط", "warning");
        return;
      }
      setFoundUser(data.user);
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSearching(false);
    }
  };

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleAddMember = async () => {
    if (!foundUser || submitting) return;
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnitId}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            userId: foundUser.id,
            role,
            permissions,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إضافة العضو", "error");
        return;
      }
      const newMember: SerializableMember = {
        id: data.memberId,
        userId: foundUser.id,
        role,
        permissions,
        isActive: true,
        userName: foundUser.name,
        userEmail: foundUser.email,
      };
      onMembersChange([...members, newMember]);
      toast("تمت إضافة العضو بنجاح", "success");
      setDialogOpen(false);
      resetDialog();
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (memberId: number) => {
    if (removingId !== null) return;
    if (!confirm("هل أنت متأكد من إزالة هذا العضو؟")) return;
    setRemovingId(memberId);
    try {
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnitId}/members/${memberId}`,
        {
          method: "DELETE",
          headers: { "Idempotency-Key": crypto.randomUUID() },
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إزالة العضو", "error");
        return;
      }
      onMembersChange(members.filter((m) => m.id !== memberId));
      toast("تمت إزالة العضو", "success");
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setRemovingId(null);
    }
  };

  const activeMembers = members.filter((m) => m.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">أعضاء النشاط</h3>
          <p className="text-sm text-gray-500">
            {activeMembers.length} عضو نشط
          </p>
        </div>
        {isOwner && (
          <Button
            iconLeft={<UserPlus className="h-4 w-4" />}
            onClick={() => setDialogOpen(true)}
          >
            إضافة عضو
          </Button>
        )}
      </div>

      {activeMembers.length === 0 ? (
        <Empty
          icon={UserPlus}
          title="لا يوجد أعضاء بعد"
          description="أضف مديرًا أو موظفًا لمساعدتك في إدارة النشاط التجاري."
        />
      ) : (
        <div className="space-y-2">
          {activeMembers.map((m) => (
            <Card key={m.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {m.userName}
                      {m.userId === currentUserId && (
                        <span className="ml-1 text-xs font-normal text-gray-500">
                          (أنت)
                        </span>
                      )}
                    </p>
                    <Badge
                      variant={ROLE_VARIANT[m.role] ?? "gray"}
                    >
                      <Shield className="h-3 w-3" />
                      {ROLE_LABEL[m.role] ?? m.role}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{m.userEmail}</p>
                  {m.permissions.length > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      {m.permissions.length} صلاحية
                    </p>
                  )}
                </div>
                {isOwner && m.role !== "OWNER" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={removingId === m.id}
                    onClick={() => handleRemove(m.id)}
                    iconLeft={
                      removingId !== m.id ? (
                        <Trash2 className="h-4 w-4" />
                      ) : undefined
                    }
                  >
                    إزالة
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          resetDialog();
        }}
        title="إضافة عضو جديد"
        description="ابحث عن المستخدم بالبريد الإلكتروني أو رقم الهاتف"
        size="lg"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetDialog();
              }}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleAddMember}
              loading={submitting}
              disabled={!foundUser}
              iconLeft={<Plus className="h-4 w-4" />}
            >
              إضافة العضو
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="البريد الإلكتروني أو رقم الهاتف"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              fullWidth
            />
            <Button
              variant="secondary"
              onClick={handleSearch}
              loading={searching}
              iconLeft={!searching ? <Search className="h-4 w-4" /> : undefined}
            >
              بحث
            </Button>
          </div>

          {foundUser && (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-900">
                  {foundUser.name}
                </p>
                <p className="text-xs text-emerald-700">{foundUser.email}</p>
              </div>

              <Select
                label="الدور"
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "MANAGER" | "STAFF")
                }
                options={[
                  { value: "STAFF", label: "موظف — صلاحيات محدودة" },
                  { value: "MANAGER", label: "مدير — صلاحيات أوسع" },
                ]}
              />

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  الصلاحيات
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {PERMISSIONS_OPTIONS.map((p) => {
                    const selected = permissions.includes(p.value);
                    return (
                      <label
                        key={p.value}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => togglePermission(p.value)}
                          className="h-4 w-4 accent-[#ff5c00]"
                        />
                        <span className="text-gray-700">{p.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {searching && (
            <div className="flex justify-center py-4">
              <Spinner label="جارٍ البحث..." />
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}