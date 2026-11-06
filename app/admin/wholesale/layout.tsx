import { WholesaleAdminNav } from "@/components/admin/wholesale/WholesaleAdminNav";

export default function AdminWholesaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <WholesaleAdminNav />
      {children}
    </div>
  );
}