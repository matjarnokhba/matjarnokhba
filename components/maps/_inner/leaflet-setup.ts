"use client";

import L from "leaflet";

// Custom branded marker — avoids asset pipeline issues with default markers
export function createPinIcon(color = "#ff5c00") {
  return L.divIcon({
    className: "custom-map-pin",
    html: `<div style="position:relative;width:32px;height:40px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 30" width="32" height="40" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
        <path d="M12 0C5.4 0 0 5.4 0 12c0 8 12 18 12 18s12-10 12-18c0-6.6-5.4-12-12-12z" fill="${color}"/>
        <circle cx="12" cy="12" r="5" fill="white"/>
      </svg>
    </div>`,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
    tooltipAnchor: [0, -40],
  });
}

export function createDotIcon(color = "#22c55e", label?: string) {
  const labelHtml = label
    ? `<div style="position:absolute;top:-22px;left:50%;transform:translateX(-50%);background:#111;color:white;font-size:10px;padding:2px 6px;border-radius:4px;white-space:nowrap;font-weight:bold;">${label}</div>`
    : "";
  return L.divIcon({
    className: "custom-map-dot",
    html: `<div style="position:relative;width:20px;height:20px;">${labelHtml}<div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export { L };