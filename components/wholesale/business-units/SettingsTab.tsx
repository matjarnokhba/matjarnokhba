"use client";

import { useState } from "react";
import { Save, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/lib/hooks/useToast";
import type { SerializableBusinessUnit } from "./types";

export interface SettingsTabProps {
  businessUnit: SerializableBusinessUnit;
}

export function SettingsTab({ businessUnit }: SettingsTabProps) {
  const { toast } = useToast();

  const [name, setName] = useState(businessUnit.name);
  const [description, setDescription] = useState(
    businessUnit.description ?? ""
  );
  const [logo, setLogo] = useState(businessUnit.logo ?? "");
  const [status, setStatus] = useState(businessUnit.status);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasChanges =
    name !== businessUnit.name ||
    description !== (businessUnit.description ?? "") ||
    logo !== (businessUnit.logo ?? "") ||
    status !== businessUnit.status;

  const handleSave = async () => {
    if (!hasChanges || saving) return;
    if (name.trim().length < 2) {
      toast("اسم النشاط يجب أن يكون حرفين على الأقل", "warning");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, any> = {};
      if (name !== businessUnit.name) body.name = name.trim();
      if (description !== (businessUnit.description ?? ""))
        body.description = description.trim() || null;
      if (logo !== (businessUnit.logo ?? ""))
        body.logo = logo.trim() || null;
      if (status !== businessUnit.status) body.status = status;

      const res = await fetch(
        `/api/wholesale/business-units/${businessUnit.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل الحفظ", "error");
        return;
      }
      toast("تم حفظ التغييرات", "success");
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/wholesale/business-units/${businessUnit.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ status: "CLOSED" }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast(data.message || "فشل إغلاق النشاط", "error");
        return;
      }
      toast("تم إغلاق النشاط", "success");
      setDeleteOpen(false);
    } catch {
      toast("حدث خطأ في الاتصال", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-4 text-base font-bold text-gray-900">
          معلومات النشاط
        </h3>
        <div className="space-y-4">
          <Input
            label="اسم النشاط"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={200}
            required
          />
          <Textarea
            label="الوصف"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={2000}
            hint={`${description.length}/2000`}
          />
          <Input
            label="رابط الشعار (Logo URL)"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://..."
            hint="رابط صورة شعار النشاط التجاري"
          />
          <Select
            label="حالة النشاط"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "ACTIVE", label: "نشط — يستقبل الطلبات" },
              { value: "SUSPENDED", label: "موقوف — لا يستقبل طلبات" },
            ]}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
            iconLeft={!saving ? <Save className="h-4 w-4" /> : undefined}
          >
            حفظ التغييرات
          </Button>
        </div>
      </Card>

      <Card className="border border-red-200">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-red-900">
              منطقة الخطر
            </h3>
            <p className="mt-1 text-sm text-red-800">
              إغلاق النشاط سيؤدي إلى إيقافه بشكل دائم. لا يمكن التراجع.
              المنتجات والعروض المرتبطة به ستبقى في النظام للتاريخ.
            </p>
            <div className="mt-3">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                iconLeft={<Trash2 className="h-4 w-4" />}
              >
                إغلاق النشاط
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="تأكيد إغلاق النشاط"
        description="هذا الإجراء نهائي — لا يمكن استرجاع النشاط."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              نعم، أغلق النشاط
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            أنت على وشك إغلاق <strong>{businessUnit.name}</strong>.
          </p>
          <ul className="list-inside list-disc space-y-1 text-xs text-gray-500">
            <li>لن يستقبل طلبات جديدة</li>
            <li>ستبقى العروض والمنتجات في النظام للتاريخ</li>
            <li>لن يتمكن المشترون من الوصول إلى منتجاتك</li>
          </ul>
        </div>
      </Dialog>
    </div>
  );
}