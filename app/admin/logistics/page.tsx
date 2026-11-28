"use client";

import { useState } from "react";
import WarehousesTab from "@/components/admin/logistics/WarehousesTab";
import CompaniesTab from "@/components/admin/logistics/CompaniesTab";
import MembershipsTab from "@/components/admin/logistics/MembershipsTab";
import AuditTab from "@/components/admin/logistics/AuditTab";
import MovementsTab from "@/components/admin/logistics/MovementsTab";
import TransfersTab from "@/components/admin/logistics/TransfersTab";
import PlatformsTab from "@/components/admin/logistics/PlatformsTab";
import RoutingTab from "@/components/admin/logistics/RoutingTab";
import ApplicationsTab from "@/components/admin/logistics/ApplicationsTab";
import ProvidersTab from "@/components/admin/logistics/ProvidersTab";
import ExternalShipmentsTab from "@/components/admin/logistics/ExternalShipmentsTab";
import SettlementsTab from "@/components/admin/logistics/SettlementsTab";
import GuidePanel from "@/components/admin/logistics/GuidePanel";

type Tab = "warehouses" | "companies" | "staff" | "transfers" | "platforms" | "providers" | "external" | "settlements" | "audit" | "movements" | "routing" | "applications";

const TABS: { key: Tab; label: string }[] = [
  { key: "warehouses", label: "المستودعات" },
  { key: "companies", label: "شركات داخلية" },
  { key: "staff", label: "الموظفون" },
  { key: "transfers", label: "التحويلات" },
  { key: "platforms", label: "المنصات" },
  { key: "routing", label: "التوزيع" },
  { key: "applications", label: "طلبات الشركات" },
  { key: "providers", label: "شركات خارجية" },
  { key: "external", label: "الشحنات الخارجية" },
  { key: "settlements", label: "التسويات" },
  { key: "audit", label: "سجل التدقيق" },
  { key: "movements", label: "حركة الطرود" },
];

export default function LogisticsPage() {
  const [tab, setTab] = useState<Tab>("warehouses");
  const [staffWarehouse, setStaffWarehouse] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-bold">إدارة اللوجستيك</h1>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              if (t.key !== "staff") setStaffWarehouse(null);
              setTab(t.key);
            }}
            className={
              "shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold " +
              (tab === t.key ? "bg-white text-[#ff5c00] shadow" : "text-gray-600")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <GuidePanel tab={tab} />
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
      {tab === "routing" && <RoutingTab />}
      {tab === "applications" && <ApplicationsTab />}
      {tab === "providers" && <ProvidersTab />}
      {tab === "external" && <ExternalShipmentsTab />}
      {tab === "settlements" && <SettlementsTab />}
      {tab === "movements" && <MovementsTab />}
    </div>
  );
}