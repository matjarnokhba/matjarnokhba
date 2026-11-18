"use client";

import dynamic from "next/dynamic";
import type { LiveMapProps } from "./types";

const LiveMapInner = dynamic(() => import("./_inner/LiveMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500"
      style={{ height: 480 }}
    >
      جارٍ تحميل الخريطة...
    </div>
  ),
});

export function LiveMap(props: LiveMapProps) {
  return <LiveMapInner {...props} />;
}

export type { LiveMapProps };