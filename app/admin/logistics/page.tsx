"use client";

import { useState } from "react";
import WarehousesTab from "@/components/admin/logistics/WarehousesTab";
import CompaniesTab from "@/components/admin/logistics/CompaniesTab";
import MembershipsTab from "@/components/admin/logistics/MembershipsTab";
import AuditTab from "@/components/admin/logistics/AuditTab";
import MovementsTab from "@/components/admin/logistics/MovementsTab";
import TransfersTab from "@/components/admin/logistics/TransfersTab";
import PlatformsTab from "@/components/admin/logistics/PlatformsTab";

type Tab = "warehouses" | "companies" | "staff" | "transfers" | "platforms" | "audit" | "movements";

const TABS: { key: Tab; label: string }[] = [
  { key: "warehouses", label: "المستودعات" },
  { key: "companies", label: "الشركات" },
  { key: "staff", label: "الموظفون" },
  { key: "transfers", label: "التحويلات" },
  { key: "platforms", label: "المنصات" },
  { key: "audit", label: "سجل التدقيق" },
  { key: "movements", label: "حركة الطرود" },
];

export default function LogisticsPage() {
  const [tab, setTab] = useState<Tab>("warehouses");
  const [staffWarehouse, setStaffWarehouse] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-bold">إدارة اللوجستيك</h1>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (t.key !== "staff") setStaffWarehouse(null);
              setTab(t.key);
            }}
            className={
              "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold " +
              (tab === t.key ? "bg-white text-[#ff5c00] shadow" : "text-gray-600")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "warehouses" && (
        <WarehousesTab
          onShowStaff={(id) => {
            setStaffWarehouse(id);
            setTab("staff");
          }}
        />
      )}
      {tab === "companies" && <CompaniesTab />}
      {tab === "staff" && <MembershipsTab key={String(staffWarehouse)} initialWarehouseId={staffWarehouse} />}
      {tab === "audit" && <AuditTab />}
      {tab === "transfers" && <TransfersTab />}
      {tab === "platforms" && <PlatformsTab />}
      {tab === "movements" && <MovementsTab />}
    </div>
  );
}