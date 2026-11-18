"use client";

import dynamic from "next/dynamic";
import type { StaticMapProps } from "./types";

const StaticMapInner = dynamic(() => import("./_inner/StaticMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500"
      style={{ height: 240 }}
    >
      جارٍ تحميل الخريطة...
    </div>
  ),
});

export function StaticMap(props: StaticMapProps) {
  return <StaticMapInner {...props} />;
}

export type { StaticMapProps };