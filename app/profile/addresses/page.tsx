"use client";

import type { LocalCity } from "@/components/address/CityPicker";
import type { DistrictValue } from "@/components/address/DistrictInput";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  MapPin,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import AddressForm, {
  type AddressFormData,
} from "@/components/address/AddressForm";
import AddressCard, {
  type AddressDisplay,
} from "@/components/address/AddressCard";

type Mode =
  | { type: "list" }
  | { type: "create" }
  | { type: "edit"; id: number };

export default function ProfileAddressesPage() {
  const [addresses, setAddresses] = useState<AddressDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>({ type: "list" });
  const [editingAddress, setEditingAddress] = useState<
    Partial<AddressFormData> | undefined
  >(undefined);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/user/addresses");
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setAddresses(data.addresses);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(form: AddressFormData) {
    const res = await fetch("/api/user/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        city: form.city,
        district: form.district,
        fullAddressText: form.fullAddressText,
        buildingNumber: form.buildingNumber || null,
        landmark: form.landmark || null,
        postalCode: form.postalCode || null,
        isDefault: form.isDefault,
      }),
    });
    
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "فشل الحفظ");
    }

    setMessage({ type: "success", text: "✅ تم إضافة العنوان" });
    setMode({ type: "list" });
    await load();
    setTimeout(() => setMessage(null), 2500);
  }

  async function handleUpdate(form: AddressFormData) {
    if (!form.id) throw new Error("معرف مفقود");

    const res = await fetch(`/api/user/addresses/${form.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        city: form.city,
        district: form.district,
        fullAddressText: form.fullAddressText,
        buildingNumber: form.buildingNumber || null,
        landmark: form.landmark || null,
        postalCode: form.postalCode || null,
        isDefault: form.isDefault,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "فشل التحديث");
    }

    setMessage({ type: "success", text: "✅ تم تحديث العنوان" });
    setMode({ type: "list" });
    setEditingAddress(undefined);
    await load();
    setTimeout(() => setMessage(null), 2500);
  }

  async function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا العنوان؟")) return;

    try {
      const res = await fetch(`/api/user/addresses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل الحذف" });
        return;
      }
      setMessage({ type: "success", text: "✅ تم حذف العنوان" });
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    }
  }

  async function handleSetDefault(id: number) {
    try {
      const res = await fetch(`/api/user/addresses/${id}/set-default`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: data.message || "فشل" });
        return;
      }
      setMessage({ type: "success", text: "✅ تم تعيين العنوان الافتراضي" });
      await load();
      setTimeout(() => setMessage(null), 2500);
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    }
  }

  async function handleEdit(id: number) {
    try {
      const res = await fetch(`/api/user/addresses/${id}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setMessage({ type: "error", text: "فشل التحميل" });
        return;
      }

      const a = data.address;

      const city: LocalCity | null = a.cityText
        ? {
            name: a.cityText,
            nameFr: a.cityText,
            slug: a.citySlug || a.cityText.toLowerCase().replace(/\s+/g, "-"),
            region: "",
          }
        : null;

      const district: DistrictValue | null = a.districtText
        ? {
            name: a.districtText,
            placeId: a.districtPlaceId || null,
            verified: !!a.districtPlaceId,
          }
        : null;

      setEditingAddress({
        id: a.id,
        firstName: a.firstName || a.fullName.split(" ")[0] || "",
        lastName:
          a.lastName || a.fullName.split(" ").slice(1).join(" ") || "",
        phone: a.phone,
        city,
        district,
        fullAddressText:
          a.fullAddressText || a.street || "",
        buildingNumber: a.buildingNumber || "",
        landmark: a.landmark || "",
        postalCode: a.postalCode || "",
        isDefault: a.isDefault,
      });
      setMode({ type: "edit", id });
    } catch {
      setMessage({ type: "error", text: "فشل الاتصال" });
    }
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/profile"
            className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            رجوع
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <MapPin className="h-6 w-6 text-[#ff5c00]" />
            عناويني
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {addresses.length} / 10 عنوان
          </p>
        </div>

        {mode.type === "list" && addresses.length < 10 && (
          <button
            onClick={() => {
              setEditingAddress(undefined);
              setMode({ type: "create" });
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
          >
            <Plus className="h-4 w-4" />
            إضافة عنوان
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${
            message.type === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Content */}
      {mode.type === "list" && (
        <>
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
              <p className="mt-3 text-sm text-red-700">{error}</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
              <MapPin className="mx-auto h-12 w-12 text-gray-300" />
              <h2 className="mt-3 text-base font-black">لا توجد عناوين</h2>
              <p className="mt-2 text-xs text-gray-500">
                أضف عنوانك الأول لتسهيل عملية الشراء القادمة
              </p>
              <button
                onClick={() => setMode({ type: "create" })}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ff5c00] px-6 py-3 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" />
                إضافة عنوان
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <AddressCard
                  key={a.id}
                  address={a}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onSetDefault={handleSetDefault}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      {(mode.type === "create" || mode.type === "edit") && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">
                {mode.type === "create" ? "إضافة عنوان جديد" : "تعديل العنوان"}
              </h2>
              <button
                onClick={() => {
                  setMode({ type: "list" });
                  setEditingAddress(undefined);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AddressForm
              initial={editingAddress}
              onSubmit={mode.type === "create" ? handleCreate : handleUpdate}
              onCancel={() => {
                setMode({ type: "list" });
                setEditingAddress(undefined);
              }}
              submitLabel={
                mode.type === "create" ? "إضافة العنوان" : "حفظ التعديلات"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}