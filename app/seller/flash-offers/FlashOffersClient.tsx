"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Flame, Loader2, CheckCircle2, XCircle, Clock, Info, Plus } from "lucide-react";

type Offer = {
  id: number;
  version: number;
  status: string;
  source: string;
  sellerSharePct: number;
  dealPrice: number | null;
  basePrice: number | null;
  quantityLimit: number | null;
  soldCount: number;
  responseNote: string | null;
  sale: { id: number; title: string; startsAt: string; endsAt: string; isActive: boolean };
  product: { id: number; name: string; image: string | null };
  soldQty: number;
  sellerBorne: number;
  platformSubsidy: number;
};
type Summary = { soldQty: number; sellerBorne: number; platformSubsidy: number };
type Tab = "requests" | "active" | "ended";

const money = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} د.م`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("ar-MA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function statusInfo(o: Offer, ended: boolean): { label: string; cls: string } {
  if (o.status === "PENDING_SELLER") return { label: "بانتظار ردّك", cls: "bg-amber-100 text-amber-700" };
  if (o.status === "REJECTED") return { label: o.source === "SELLER" ? "رفضته الإدارة" : "رفضتَه", cls: "bg-red-100 text-red-700" };
  if (o.status === "PENDING_ADMIN") return { label: "بانتظار الإدارة", cls: "bg-blue-100 text-blue-700" };
  if (o.status === "WITHDRAWN") return { label: "مسحوب", cls: "bg-gray-100 text-gray-600" };
  if (ended) return { label: "منتهٍ", cls: "bg-gray-100 text-gray-600" };
  if (o.source === "SELLER") return { label: "معتمد من الإدارة", cls: "bg-green-100 text-green-700" };
  if (o.sellerSharePct > 0) return { label: "وافقتَ عليه", cls: "bg-green-100 text-green-700" };
  return { label: "المنصة تتحمل", cls: "bg-gray-100 text-gray-700" };
}

export default function FlashOffersClient() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [summary, setSummary] = useState<Summary>({ soldQty: 0, sellerBorne: 0, platformSubsidy: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("requests");
  const [busy, setBusy] = useState<number | null>(null);
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [showPropose, setShowPropose] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: number; title: string; startsAt: string; endsAt: string }[]>([]);
  const [myProducts, setMyProducts] = useState<{ id: number; name: string; price: number }[]>([]);
  const [pf, setPf] = useState({ saleId: "", productId: "", price: "", qty: "" });
  const [proposing, setProposing] = useState(false);
  const [pErr, setPErr] = useState("");

  async function openPropose() {
    setShowPropose(true);
    setPErr("");
    setPf({ saleId: "", productId: "", price: "", qty: "" });
    try {
      const [c, p] = await Promise.all([
        fetch("/api/seller/flash-offers/campaigns", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/seller/products", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setCampaigns(c.campaigns ?? c.data?.campaigns ?? []);
      const list = p.products ?? p.data?.products ?? p.data ?? [];
      setMyProducts(Array.isArray(list) ? list.map((x: any) => ({ id: x.id, name: x.name, price: Number(x.price) || 0 })) : []);
    } catch {
      setPErr("تعذر تحميل الحملات أو المنتجات");
    }
  }

  async function submitPropose() {
    const prod = myProducts.find((p) => String(p.id) === pf.productId);
    const price = Number(pf.price);
    const qty = Number(pf.qty);
    if (!pf.saleId || !prod) return setPErr("اختر الحملة والمنتج");
    if (!(price > 0) || (prod.price > 0 && price >= prod.price)) return setPErr("سعر العرض يجب أن يكون أقل من سعر المنتج الحالي");
    if (!Number.isInteger(qty) || qty < 1) return setPErr("الكمية عدد صحيح موجب");
    setProposing(true);
    setPErr("");
    try {
      const res = await fetch("/api/seller/flash-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: Number(pf.saleId), productId: prod.id, dealPrice: price, quantityLimit: qty }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return setPErr(j.message || "تعذر إرسال الاقتراح");
      setShowPropose(false);
      await load();
    } finally {
      setProposing(false);
    }
  }

  async function withdraw(o: Offer) {
    setBusy(o.id);
    setErr("");
    try {
      const res = await fetch(`/api/seller/flash-offers/${o.id}/withdraw`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.message || "تعذر سحب العرض");
      await load();
    } finally {
      setBusy(null);
    }
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/flash-offers", { cache: "no-store" });
      const j = await res.json();
      setOffers(j.offers ?? j.data?.offers ?? []);
      setSummary(j.summary ?? j.data?.summary ?? { soldQty: 0, sellerBorne: 0, platformSubsidy: 0 });
    } catch {
      setErr("تعذر تحميل العروض");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const nowMs = Date.now();
  const isEnded = (o: Offer) => new Date(o.sale.endsAt).getTime() < nowMs;
  const groups = useMemo(() => {
    const requests = offers.filter((o) => o.status === "PENDING_SELLER" && !isEnded(o));
    const ended = offers.filter((o) => isEnded(o) || o.status === "REJECTED" || o.status === "WITHDRAWN");
    const active = offers.filter((o) => !requests.includes(o) && !ended.includes(o));
    return { requests, active, ended };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  async function respond(o: Offer, action: "APPROVE" | "REJECT") {
    setBusy(o.id);
    setErr("");
    try {
      const res = await fetch(`/api/seller/flash-offers/${o.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: o.version, note: action === "REJECT" ? note.trim() || undefined : undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setErr(j.message || "تعذر إرسال الرد");
      else {
        setRejectFor(null);
        setNote("");
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const list = groups[tab];
  const tabs: { key: Tab; label: string; n: number }[] = [
    { key: "requests", label: "بانتظار ردّك", n: groups.requests.length },
    { key: "active", label: "عروضي", n: groups.active.length },
    { key: "ended", label: "المنتهية", n: groups.ended.length },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Flame className="h-5 w-5 text-[#ff5c00]" />
        <h1 className="text-lg font-black">عروضي المحدودة</h1>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openPropose}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white hover:bg-[#e64a00]"
        >
          <Plus className="h-4 w-4" /> اقتراح عرض على منتج
        </button>
      </div>

      {showPropose && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setShowPropose(false)}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h2 className="mb-1 text-base font-black">اقتراح عرض محدود</h2>
            <p className="mb-3 text-[11px] leading-5 text-gray-500">
              تتحمل أنت كامل الخصم (مناسب لتصريف مخزون راكد). يظهر العرض بعد اعتماد الإدارة.
            </p>
            <div className="space-y-2.5">
              <select
                value={pf.saleId}
                onChange={(e) => setPf({ ...pf, saleId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-[#ff5c00]"
              >
                <option value="">اختر الحملة</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — {when(c.startsAt)} → {when(c.endsAt)}
                  </option>
                ))}
              </select>
              <select
                value={pf.productId}
                onChange={(e) => setPf({ ...pf, productId: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-[#ff5c00]"
              >
                <option value="">اختر المنتج</option>
                {myProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({money(p.price)})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="سعر العرض"
                  value={pf.price}
                  onChange={(e) => setPf({ ...pf, price: e.target.value })}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-[#ff5c00]"
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="الكمية المعروضة"
                  value={pf.qty}
                  onChange={(e) => setPf({ ...pf, qty: e.target.value })}
                  className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-[#ff5c00]"
                />
              </div>
              {pErr && <div className="rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{pErr}</div>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={proposing}
                  onClick={submitPropose}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#ff5c00] py-2.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {proposing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} إرسال للإدارة
                </button>
                <button
                  type="button"
                  onClick={() => setShowPropose(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-600"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
          <div className="text-[11px] text-gray-500">قطع بيعت بعروض</div>
          <div className="text-base font-black">{summary.soldQty}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
          <div className="text-[11px] text-gray-500">تحمّلتَه من الخصم</div>
          <div className="text-base font-black text-red-600">{money(summary.sellerBorne)}</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3 text-center">
          <div className="text-[11px] text-gray-500">دعم المنصة لك</div>
          <div className="text-base font-black text-green-600">{money(summary.platformSubsidy)}</div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-bold ${
              tab === t.key ? "bg-white text-[#ff5c00] shadow-sm" : "text-gray-600"
            }`}
          >
            {t.label} ({t.n})
          </button>
        ))}
      </div>

      {err && <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{err}</div>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">لا توجد عروض هنا.</div>
      ) : (
        <div className="space-y-3">
          {list.map((o) => {
            const ended = isEnded(o);
            const st = statusInfo(o, ended);
            const discount = o.basePrice != null && o.dealPrice != null ? o.basePrice - o.dealPrice : null;
            const perUnit = discount != null ? (discount * o.sellerSharePct) / 100 : null;
            const canAnswer = o.status === "PENDING_SELLER" && !ended;
            return (
              <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {o.product.image && (
                      <img src={o.product.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate text-sm font-bold">{o.product.name}</div>
                      <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {o.sale.title} · {when(o.sale.startsAt)} → {when(o.sale.endsAt)}
                    </div>
                    <div className="mt-1 text-xs">
                      {o.dealPrice != null && (
                        <>
                          <span className="font-black text-[#ff5c00]">{money(o.dealPrice)}</span>
                          {o.basePrice != null && <span className="mr-2 text-gray-400 line-through">{money(o.basePrice)}</span>}
                        </>
                      )}
                      {o.quantityLimit != null && <span className="mr-2 text-gray-500">الكمية: {o.quantityLimit}</span>}
                    </div>
                  </div>
                </div>

                <div className="mt-2 rounded-lg bg-gray-50 p-2 text-[11px] leading-5 text-gray-700">
                  {o.source === "SELLER" ? (
                    <>عرض اقترحتَه أنت: تتحمل كامل الخصم، وتُحاسَب بسعر العرض.</>
                  ) : o.sellerSharePct > 0 ? (
                    <>
                      تتحمل <b>{o.sellerSharePct}%</b> من الخصم
                      {perUnit != null && (
                        <>
                          {" "}
                          = <b>{money(perUnit)}</b> عن كل قطعة تُباع، والمنصة تتحمل الباقي وتدفع لك الباقي كأنك بعت بالسعر الأصلي.
                        </>
                      )}
                      {o.quantityLimit != null && perUnit != null && (
                        <> الحد الأقصى الذي قد تتحمله: <b>{money(perUnit * o.quantityLimit)}</b>.</>
                      )}
                    </>
                  ) : (
                    <>المنصة تتحمل كامل الخصم، وتُحاسَب أنت على السعر الأصلي.</>
                  )}
                </div>

                {(o.soldQty > 0 || o.soldCount > 0) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-600">
                    <span>مباع: <b>{o.soldQty || o.soldCount}</b></span>
                    <span>تحمّلتَ: <b className="text-red-600">{money(o.sellerBorne)}</b></span>
                    <span>دعم المنصة: <b className="text-green-600">{money(o.platformSubsidy)}</b></span>
                  </div>
                )}

                {o.status === "REJECTED" && o.responseNote && (
                  <div className="mt-2 flex items-start gap-1 text-[11px] text-gray-500">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" /> سبب الرفض: {o.responseNote}
                  </div>
                )}

                {o.source === "SELLER" &&
                  (o.status === "PENDING_ADMIN" || o.status === "APPROVED") &&
                  !ended &&
                  o.soldQty === 0 &&
                  o.soldCount === 0 && (
                    <button
                      type="button"
                      disabled={busy === o.id}
                      onClick={() => withdraw(o)}
                      className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-bold text-gray-700 disabled:opacity-60"
                    >
                      {busy === o.id ? "..." : "سحب العرض"}
                    </button>
                  )}

                {canAnswer && (
                  <div className="mt-3">
                    {rejectFor === o.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={300}
                          rows={2}
                          placeholder="سبب الرفض (اختياري)"
                          className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs outline-none focus:border-[#ff5c00]"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy === o.id}
                            onClick={() => respond(o, "REJECT")}
                            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                          >
                            {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                            تأكيد الرفض
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectFor(null);
                              setNote("");
                            }}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600"
                          >
                            رجوع
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy === o.id}
                          onClick={() => respond(o, "APPROVE")}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#ff5c00] py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          {busy === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          موافقة
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectFor(o.id);
                            setNote("");
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-xs font-bold text-gray-700"
                        >
                          <XCircle className="h-3.5 w-3.5" /> رفض
                        </button>
                      </div>
                    )}
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock className="h-3 w-3" /> إن لم تردّ قبل بداية الحملة لن يظهر المنتج في العروض.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}