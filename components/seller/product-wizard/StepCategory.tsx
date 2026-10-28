"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, FolderTree, Check, Loader2, AlertCircle, Lock } from "lucide-react";
import type { Category } from "./types";

type Props = {
  categories: Category[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (category: Category) => void;
  readOnly?: boolean;
};

export default function StepCategory({
  categories,
  loading,
  selectedId,
  onSelect,
  readOnly = false,
}: Props) {
  const [pickedParentId, setPickedParentId] = useState<number | null>(null);

  const parents = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  );

  const children = useMemo(
    () => (pickedParentId ? categories.filter((c) => c.parentId === pickedParentId) : []),
    [categories, pickedParentId]
  );

  useEffect(() => {
    if (selectedId && !pickedParentId) {
      const sel = categories.find((c) => c.id === selectedId);
      if (sel?.parentId) setPickedParentId(sel.parentId);
    }
  }, [selectedId, pickedParentId, categories]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  if (readOnly) {
    const current = categories.find((c) => c.id === selectedId);
    const parent = current?.parentId
      ? categories.find((c) => c.id === current.parentId)
      : null;
    return (
      <div className="space-y-4" dir="rtl">
        <div className="rounded-xl bg-orange-50 p-4 flex items-start gap-2">
          <Lock className="mt-0.5 h-4 w-4 text-orange-600 shrink-0" />
          <div>
            <div className="text-xs text-gray-500">الفئة الحالية</div>
            <div className="mt-1 text-sm font-black text-gray-900">
              {parent ? `${parent.name} → ${current?.name}` : current?.name}
            </div>
            <div className="mt-2 text-[11px] text-gray-600">
              لا يمكن تغيير الفئة بعد إنشاء المنتج. لإنشاء منتج في فئة أخرى، احذف هذا وأنشئ منتجًا جديدًا.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>اختر الفئة الرئيسية ثم الفئة الفرعية. هذا يحدد الحقول والخيارات التي ستظهر لك في الخطوة التالية.</p>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900">
          <FolderTree className="h-4 w-4 text-[#ff5c00]" />
          الفئة الرئيسية
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {parents.map((p) => {
            const isPicked = pickedParentId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPickedParentId(p.id);
                  if (selectedId) {
                    const sel = categories.find((c) => c.id === selectedId);
                    if (sel?.parentId !== p.id) onSelect({ ...p, id: -1 } as Category);
                  }
                }}
                className={`rounded-lg border-2 p-3 text-right transition ${
                  isPicked
                    ? "border-[#ff5c00] bg-[#fff4ed]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="text-xs font-bold text-gray-900">{p.name}</div>
                <div className="mt-0.5 text-[10px] text-gray-500">
                  {categories.filter((c) => c.parentId === p.id).length} فرع
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {pickedParentId && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900">
            <ChevronLeft className="h-4 w-4 text-[#ff5c00]" />
            الفئة الفرعية
          </h3>
          {children.length === 0 ? (
            <div className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">
              لا توجد فئات فرعية — اختر فئة رئيسية أخرى
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {children.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c)}
                    className={`flex items-center justify-between rounded-lg border-2 p-3 text-right transition ${
                      isSelected
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-gray-900 truncate">{c.name}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-green-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedId && selectedId > 0 && (
        <div className="rounded-lg bg-green-50 p-3 text-xs font-bold text-green-800">
          ✅ تم اختيار: {categories.find((c) => c.id === selectedId)?.name}
        </div>
      )}
    </div>
  );
}