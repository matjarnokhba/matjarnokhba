"use client";

import dynamic from "next/dynamic";
import type { MapPickerProps } from "./types";

const MapPickerInner = dynamic(() => import("./_inner/MapPickerInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500"
      style={{ height: 380 }}
    >
      جارٍ تحميل الخريطة...
    </div>
  ),
});

export function MapPicker(props: MapPickerProps) {
  return <MapPickerInner {...props} />;
}

export type { MapPickerProps };