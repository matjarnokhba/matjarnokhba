"use client";

import { useState, useCallback } from "react";
import { useUploadThing } from "@/lib/uploadthing";
import { Upload, Loader2, FileText, X, AlertCircle } from "lucide-react";

type DocumentUploaderProps = {
  onSuccess: (data: {
    url: string;
    name: string;
    size: number;
    mimeType: string;
  }) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  accept?: "pdf" | "image" | "both";
};

export default function DocumentUploader({
  onSuccess,
  onError,
  disabled = false,
  accept = "both",
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { startUpload } = useUploadThing("documentUploader", {
    onClientUploadComplete: (res) => {
      setUploading(false);
      setSelectedFile(null);
      if (res && res[0]) {
        const file = res[0];
        onSuccess({
          url: file.url,
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        });
      }
    },
    onUploadError: (err) => {
      setUploading(false);
      const message = err.message || "فشل رفع الملف";
      setError(message);
      onError?.(message);
    },
  });

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setError("");

      // ═══ التحقق من الحجم ═══
      if (file.size > 8 * 1024 * 1024) {
        const msg = "حجم الملف يجب أن يكون أقل من 8MB";
        setError(msg);
        onError?.(msg);
        return;
      }

      // ═══ التحقق من النوع ═══
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");

      if (accept === "pdf" && !isPdf) {
        const msg = "يُقبل PDF فقط";
        setError(msg);
        onError?.(msg);
        return;
      }
      if (accept === "image" && !isImage) {
        const msg = "يُقبل صور فقط";
        setError(msg);
        onError?.(msg);
        return;
      }
      if (accept === "both" && !isPdf && !isImage) {
        const msg = "يُقبل PDF أو صور فقط";
        setError(msg);
        onError?.(msg);
        return;
      }

      setSelectedFile(file);
      setUploading(true);
      await startUpload([file]);
    },
    [startUpload, accept, onError]
  );

  function clearFile() {
    setSelectedFile(null);
    setError("");
  }

  return (
    <div className="space-y-2">
      {!selectedFile ? (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
            disabled
              ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50"
              : "border-gray-300 bg-gray-50 hover:border-[#ff5c00] hover:bg-[#fff4ed]"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <Upload className="h-5 w-5 text-[#ff5c00]" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900">
              اختر ملفاً للرفع
            </div>
            <div className="mt-0.5 text-[10px] text-gray-500">
              {accept === "both"
                ? "PDF أو صورة (JPG, PNG)"
                : accept === "pdf"
                  ? "PDF فقط"
                  : "صور فقط"}
              {" · "}حتى 8MB
            </div>
          </div>
          <input
            type="file"
            accept={
              accept === "pdf"
                ? "application/pdf"
                : accept === "image"
                  ? "image/*"
                  : "application/pdf,image/*"
            }
            onChange={handleFileChange}
            disabled={disabled || uploading}
            className="hidden"
          />
        </label>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff4ed]">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#ff5c00]" />
            ) : (
              <FileText className="h-5 w-5 text-[#ff5c00]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-gray-900">
              {selectedFile.name}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-500">
              {(selectedFile.size / 1024).toFixed(0)} KB
              {uploading && " · جاري الرفع..."}
            </div>
          </div>
          {!uploading && (
            <button
              type="button"
              onClick={clearFile}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100"
              aria-label="إزالة"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}