"use client";

import {
  MapPin,
  Phone,
  User,
  Star,
  Edit3,
  Trash2,
  Check,
} from "lucide-react";

export type AddressDisplay = {
  id: number;
  fullName: string;
  phone: string;
  city: string;
  district: string | null;
  street: string;
  buildingNumber: string | null;
  apartment: string | null;
  landmark: string | null;
  postalCode: string | null;
  isDefault: boolean;
};

type Props = {
  address: AddressDisplay;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onSetDefault?: (id: number) => void;
  onSelect?: (id: number) => void;
  selected?: boolean;
  showActions?: boolean;
};

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  onSelect,
  selected,
  showActions = true,
}: Props) {
  return (
    <div
      className={`rounded-2xl border-2 bg-white p-4 transition ${
        selected
          ? "border-[#ff5c00] bg-[#fff4ed]"
          : "border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Radio for select mode */}
        {onSelect && (
          <button
            type="button"
            onClick={() => onSelect(address.id)}
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
          >
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                selected
                  ? "border-[#ff5c00] bg-[#ff5c00]"
                  : "border-gray-300"
              }`}
            >
              {selected && <Check className="h-3 w-3 text-white" />}
            </div>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-black">{address.fullName}</span>
            {address.isDefault && (
              <span className="flex items-center gap-1 rounded-full bg-[#ff5c00] px-2 py-0.5 text-[10px] font-bold text-white">
                <Star className="h-2.5 w-2.5" fill="currentColor" />
                افتراضي
              </span>
            )}
          </div>

          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 shrink-0" />
              <span dir="ltr">{address.phone}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {[
                  address.street,
                  address.buildingNumber,
                  address.apartment,
                ]
                  .filter(Boolean)
                  .join("، ")}
                {" — "}
                {address.district && `${address.district}، `}
                {address.city}
                {address.postalCode && ` (${address.postalCode})`}
              </span>
            </div>
            {address.landmark && (
              <div className="text-[11px] italic text-gray-500">
                📍 {address.landmark}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {!address.isDefault && onSetDefault && (
            <button
              type="button"
              onClick={() => onSetDefault(address.id)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-50"
            >
              <Star className="h-3 w-3" />
              تعيين افتراضي
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(address.id)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition hover:bg-blue-100"
            >
              <Edit3 className="h-3 w-3" />
              تعديل
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(address.id)}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-3 w-3" />
              حذف
            </button>
          )}
        </div>
      )}
    </div>
  );
}