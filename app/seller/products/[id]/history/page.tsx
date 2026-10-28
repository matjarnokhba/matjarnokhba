"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import EditHistoryList from "@/components/product/EditHistoryList";

type EditLog = {
  id: number;
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  requiresReapproval: boolean;
  reason: string | null;
  reviewedAt: string | null;
  reviewAction: string | null;
  createdAt: string;
};

export default function SellerProductHistoryPage() {
  const params = useParams();
  const productId = parseInt(params.id as string);

  const [logs, setLogs] = useState<EditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  async function load(skip = 0) {
    if (skip === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(
        `/api/seller/products/${productId}/history?skip=${skip}&take=50`
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "فشل التحميل");
        return;
      }
      setLogs((prev) => (skip === 0 ? data.logs : [...prev, ...data.logs]));
      setTotal(data.total);
    } catch {
      setError("فشل الاتصال");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load(0);
  }, [productId]);

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <Link
        href={`/seller/products/${productId}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-gray-500 transition hover:text-[#ff5c00]"
      >
        <ArrowRight className="h-3.5 w-3.5" />
        رجوع لتعديل المنتج
      </Link>

      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <History className="h-6 w-6 text-[#ff5c00]" />
          سجل التعديلات
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          كل التعديلات التي أجريتها على هذا المنتج
        </p>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 p-6 text-center text-sm font-bold text-red-700">
          {error}
        </div>
      ) : (
        <EditHistoryList
          logs={logs}
          total={total}
          loading={loading}
          onLoadMore={() => load(logs.length)}
          loadingMore={loadingMore}
        />
      )}
    </div>
  );
}