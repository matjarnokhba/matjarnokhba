"use client";

import { useState } from "react";
import { UploadButton } from "@/lib/uploadthing";
import { X, Link as LinkIcon, ImagePlus, Check } from "lucide-react";

type ImageUploaderProps = {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
};

export default function ImageUploader({
  value,
  onChange,
  maxImages = 10,
}: ImageUploaderProps) {
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [error, setError] = useState("");

  const canAddMore = value.length < maxImages;

  function removeImage(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function makeMain(index: number) {
    const reordered = [...value];
    const [item] = reordered.splice(index, 1);
    reordered.unshift(item);
    onChange(reordered);
  }

  function addUrl() {
    const url = urlInput.trim();
    if (url && !value.includes(url) && canAddMore) {
      onChange([...value, url]);
      setUrlInput("");
      setShowUrlInput(false);
      setError("");
    }
  }

  return (
    <div className="space-y-3">
      {/* ═══ شبكة الصور ═══ */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((url, i) => (
            <div
              key={i}
              className={`group relative aspect-square overflow-hidden rounded-lg border-2 bg-gray-50 ${
                i === 0 ? "border-[#ff5c00]" : "border-gray-200"
              }`}
            >
              <img
                src={url}
                alt={`صورة ${i + 1}`}
                className="h-full w-full object-cover"
              />

              {/* شارة "رئيسية" */}
              {i === 0 && (
                <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded bg-[#ff5c00] px-1.5 py-0.5 text-[9px] font-black text-white">
                  <Check className="h-2.5 w-2.5" />
                  رئيسية
                </span>
              )}

              {/* زر الحذف */}
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 shadow-md transition hover:bg-white"
                aria-label="حذف"
              >
                <X className="h-3 w-3 text-red-500" />
              </button>

              {/* زر "تعيين كرئيسية" */}
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => makeMain(i)}
                  className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[8px] font-bold text-white opacity-0 backdrop-blur transition group-hover:opacity-100"
                >
                  رئيسية
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ═══ منطقة الإضافة ═══ */}
      {canAddMore && (
        <div className="space-y-2">
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff4ed]">
                <ImagePlus className="h-6 w-6 text-[#ff5c00]" />
              </div>

              <p className="text-xs font-bold text-gray-700">
                {value.length === 0
                  ? "أضف صورة المنتج"
                  : `أضف المزيد (${value.length}/${maxImages})`}
              </p>
              <p className="text-[10px] text-gray-400">
                PNG, JPG, WEBP — حتى 4MB
              </p>

              {/* ═══ زر UploadThing ═══ */}
              <UploadButton
                endpoint="imageUploader"
                onClientUploadComplete={(res) => {
                  if (res && res.length > 0) {
                    const newUrls = res.map((f) => f.url);
                    onChange([...value, ...newUrls].slice(0, maxImages));
                    setError("");
                  }
                }}
                onUploadError={(err) => {
                  console.error("Upload error:", err);
                  setError(err.message || "فشل الرفع");
                }}
                appearance={{
                  container: "w-full flex justify-center",
                  button:
                    "bg-[#ff5c00] hover:bg-[#e64a00] text-white text-xs font-bold rounded-lg px-5 py-2.5 shadow-md w-auto ut-ready:bg-[#ff5c00] ut-uploading:cursor-not-allowed ut-uploading:bg-[#ff5c00]/70",
                  allowedContent: "hidden",
                }}
              />

              {/* ═══ زر "رابط URL" ═══ */}
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="flex items-center gap-1 text-[10px] font-bold text-gray-500 underline transition hover:text-[#ff5c00]"
              >
                <LinkIcon className="h-3 w-3" />
                أو أضف عبر رابط URL
              </button>
            </div>
          </div>

          {/* حقل URL */}
          {showUrlInput && (
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                dir="ltr"
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs outline-none focus:border-[#ff5c00] focus:bg-white"
              />
              <button
                type="button"
                onClick={addUrl}
                disabled={!urlInput.trim()}
                className="rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
              >
                إضافة
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}