"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/logistics-labels";

export const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#ff5c00] focus:outline-none";
export const btnPrimary =
  "rounded-lg bg-[#ff5c00] px-4 py-2 text-sm font-bold text-white disabled:opacity-50";
export const btnGhost =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export type ApiResult = { ok: boolean; json: any; message: string };

export async function api(
  url: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown
): Promise<ApiResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) return { ok: false, json, message: json.message || "فشل التنفيذ" };
    return { ok: true, json, message: "" };
  } catch {
    return { ok: false, json: {}, message: "فشل الاتصال" };
  }
}

const TONES: Record<Tone, string> = {
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-gray-100 text-gray-600",
  blue: "bg-blue-100 text-blue-700",
};

export function Badge({ text, tone }: { text: string; tone: Tone }) {
  return <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + TONES[tone]}>{text}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-gray-600">{label}</span>
      {children}
    </label>
  );
}