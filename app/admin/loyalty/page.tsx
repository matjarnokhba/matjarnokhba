"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Gift,
  Loader2,
  Settings as SettingsIcon,
  Package,
  Trophy,
  Plus,
  CheckCircle2,
  X,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";

// ═══════ الأنواع ═══════
type Reward = {
  id: number;
  status: string;
  createdAt: string;
  customer: { id: number; name: string; email: string; phone: string | null };
  balance: number;
  tier: { id: number; name: string; icon: string | null; requiredPoints: number };
  category: { id: number; name: string; icon: string | null } | null;
  giftProduct: { id: number; name: string; imageUrl: string | null; costPrice: number } | null;
  adminNote: string | null;
  deliveredAt: string | null;
};

type GiftProduct = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  costPrice: number;
  salePrice: number | null;
  stock: number;
  reservedStock: number;
  available: number;
  isActive: boolean;
  tier: { id: number; name: string; icon: string | null };
  category: { id: number; name: string; icon: string | null };
};

type Tier = {
  id: number;
  name: string;
  icon: string | null;
  requiredPoints: number;
  giftProductsCount: number;
};

type Category = {
  id: number;
  name: string;
  icon: string | null;
  giftProductsCount: number;
};

type Settings = {
  id: number;
  isEnabled: boolean;
  pointsPer100DH: number;
  description: string | null;
};

type Stats = {
  totalAccounts: number;
  totalRewards: number;
  pendingRewards: number;
  totalPointsIssued: number;
};

type Tab = "rewards" | "products" | "settings";

export default function AdminLoyaltyPage() {
  const [tab, setTab] = useState<Tab>("rewards");
  const [loading, setLoading] = useState(true);

  // Rewards
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardStatus, setRewardStatus] = useState("PENDING");
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);

  // Products
  const [products, setProducts] = useState<GiftProduct[]>([]);

  // Settings/Stats
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  // Modals
  const [assignModal, setAssignModal] = useState<Reward | null>(null);
  const [productModal, setProductModal] = useState<GiftProduct | "new" | null>(null);

  // ═══ تحميل أولي ═══
  useEffect(() => {
    async function load() {
      try {
        const [settingsRes, productsRes] = await Promise.all([
          fetch("/api/admin/loyalty/settings"),
          fetch("/api/admin/loyalty/gift-products"),
        ]);

        const settingsData = await settingsRes.json();
        const productsData = await productsRes.json();

        if (settingsData.success) {
          setSettings(settingsData.settings);
          setTiers(settingsData.tiers);
          setCategories(settingsData.categories);
          setStats(settingsData.stats);
        }
        if (productsData.success) {
          setProducts(productsData.products);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ═══ تحميل المكافآت ═══
  useEffect(() => {
    if (tab !== "rewards") return;
    setRewardsLoading(true);
    fetch(`/api/admin/loyalty/rewards?status=${rewardStatus}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setRewards(d.rewards);
          setWaitingCount(d.waitingForCustomer || 0);
        }
      })
      .finally(() => setRewardsLoading(false));
  }, [tab, rewardStatus]);

  async function reloadProducts() {
    const res = await fetch("/api/admin/loyalty/gift-products");
    const d = await res.json();
    if (d.success) setProducts(d.products);
  }

  async function reloadStats() {
    const res = await fetch("/api/admin/loyalty/settings");
    const d = await res.json();
    if (d.success) {
      setSettings(d.settings);
      setStats(d.stats);
      setTiers(d.tiers);
      setCategories(d.categories);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#ff5c00]" />
      </div>
    );
  }

  return (
    <div className="p-4 pt-16 lg:p-8 lg:pt-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900">
          <Gift className="h-6 w-6 text-[#ff5c00]" />
          نظام الولاء
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          إدارة المكافآت والهدايا والإعدادات
        </p>
      </div>

      {/* ═══ بطاقات الإحصائيات ═══ */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            label="حسابات الولاء"
            value={stats.totalAccounts}
            color="blue"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="إجمالي النقاط"
            value={stats.totalPointsIssued}
            color="green"
          />
          <StatCard
            icon={<Gift className="h-5 w-5" />}
            label="إجمالي المكافآت"
            value={stats.totalRewards}
            color="purple"
          />
          <StatCard
            icon={<Star className="h-5 w-5" />}
            label="بانتظار المراجعة"
            value={stats.pendingRewards}
            color="amber"
          />
        </div>
      )}

      {/* ═══ Tabs ═══ */}
      <div className="mb-5 flex gap-2 border-b border-gray-200">
        <TabButton
          active={tab === "rewards"}
          onClick={() => setTab("rewards")}
          icon={<Gift className="h-4 w-4" />}
          label="المكافآت"
        />
        <TabButton
          active={tab === "products"}
          onClick={() => setTab("products")}
          icon={<Package className="h-4 w-4" />}
          label="منتجات الهدايا"
        />
        <TabButton
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          icon={<SettingsIcon className="h-4 w-4" />}
          label="الإعدادات"
        />
      </div>

      {/* ═══ Tab: Rewards ═══ */}
      {tab === "rewards" && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setRewardStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    rewardStatus === s
                      ? "bg-[#ff5c00] text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              )
            )}
          </div>

          {/* ═══ تنبيه: عملاء لم يختاروا الفئة بعد ═══ */}
          {rewardStatus === "PENDING" && waitingCount > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
              <span className="text-base">ℹ️</span>
              <div>
                <div className="font-bold">
                  {waitingCount} مكافأة بانتظار اختيار العميل للفئة
                </div>
                <div className="mt-0.5 text-blue-700">
                  لن تظهر لك حتى يختار العميل فئته المفضلة.
                </div>
              </div>
            </div>
          )}

          {rewardsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#ff5c00]" />
            </div>
          ) : rewards.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <Gift className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                لا توجد مكافآت في هذه الحالة
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {rewards.map((r) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  onAssign={() => setAssignModal(r)}
                  onReload={async () => {
                    const res = await fetch(
                      `/api/admin/loyalty/rewards?status=${rewardStatus}`
                    );
                    const d = await res.json();
                    if (d.success) setRewards(d.rewards);
                    reloadStats();
                    reloadProducts();
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ Tab: Products ═══ */}
      {tab === "products" && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {products.length} منتج هدايا
            </p>
            <button
              onClick={() => setProductModal("new")}
              className="flex items-center gap-2 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#e64a00]"
            >
              <Plus className="h-4 w-4" />
              منتج جديد
            </button>
          </div>

          {products.length === 0 ? (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <Package className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">
                لا توجد منتجات هدايا بعد
              </p>
              <button
                onClick={() => setProductModal("new")}
                className="mt-4 rounded-lg bg-[#ff5c00] px-4 py-2 text-xs font-bold text-white"
              >
                إضافة أول منتج
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={() => setProductModal(p)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ Tab: Settings ═══ */}
      {tab === "settings" && settings && (
        <SettingsPanel
          settings={settings}
          tiers={tiers}
          categories={categories}
          onSave={async (updates) => {
            const res = await fetch("/api/admin/loyalty/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updates),
            });
            const d = await res.json();
            if (d.success) {
              setSettings({ ...settings, ...updates });
              return true;
            }
            return false;
          }}
        />
      )}

      {/* ═══ Modals ═══ */}
      {assignModal && (
        <AssignGiftModal
          reward={assignModal}
          products={products}
          onClose={() => setAssignModal(null)}
          onSaved={async () => {
            setAssignModal(null);
            const res = await fetch(
              `/api/admin/loyalty/rewards?status=${rewardStatus}`
            );
            const d = await res.json();
            if (d.success) setRewards(d.rewards);
            reloadStats();
            reloadProducts();
          }}
        />
      )}

      {productModal && (
        <ProductModal
          product={productModal === "new" ? null : productModal}
          tiers={tiers}
          categories={categories}
          onClose={() => setProductModal(null)}
          onSaved={async () => {
            setProductModal(null);
            await reloadProducts();
            await reloadStats();
          }}
        />
      )}
    </div>
  );
}

// ═══════ مكونات مساعدة ═══════

const STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار المراجعة",
  PROCESSING: "قيد التجهيز",
  SHIPPED: "تم الشحن",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
};

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "green" | "purple" | "amber";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-black text-gray-900">{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
        active
          ? "border-[#ff5c00] text-[#ff5c00]"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function RewardCard({
  reward,
  onAssign,
  onReload,
}: {
  reward: Reward;
  onAssign: () => void;
  onReload: () => void;
}) {
  async function changeStatus(newStatus: string) {
    const res = await fetch(`/api/admin/loyalty/rewards/${reward.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) onReload();
  }

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fff4ed] to-[#ffe4d3] text-2xl">
          {reward.tier.icon || "🎁"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black">{reward.tier.name}</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold">
              #{reward.id}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {reward.customer.name} · {reward.customer.email}
          </div>
          {reward.customer.phone && (
            <div className="text-[11px] text-gray-400">
              📞 {reward.customer.phone}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 font-bold text-gray-600">
              رصيد: {reward.balance}
            </span>
            {reward.category && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-600">
                {reward.category.icon} {reward.category.name}
              </span>
            )}
            {reward.giftProduct && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 font-bold text-green-600">
                ✓ {reward.giftProduct.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {reward.status === "PENDING" && (
          <>
            <button
              onClick={onAssign}
              className="flex items-center gap-1 rounded-lg bg-[#ff5c00] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#e64a00]"
            >
              <Gift className="h-3.5 w-3.5" />
              تعيين الهدية
            </button>
            <button
              onClick={() => changeStatus("CANCELLED")}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-100"
            >
              <X className="h-3.5 w-3.5" />
              إلغاء
            </button>
          </>
        )}

        {reward.status === "PROCESSING" && (
          <button
            onClick={() => changeStatus("SHIPPED")}
            className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-600"
          >
            📦 تحديد كمشحون
          </button>
        )}

        {reward.status === "SHIPPED" && (
          <button
            onClick={() => changeStatus("DELIVERED")}
            className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-green-600"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            تحديد كمُسلَّم
          </button>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  onClick,
}: {
  product: GiftProduct;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex gap-3 rounded-xl bg-white p-4 text-right shadow-sm transition hover:shadow-md"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-50">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
            🎁
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-xs font-black">{product.name}</h3>
          {!product.isActive && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-600">
              معطّل
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
          <span className="rounded-full bg-purple-50 px-1.5 py-0.5 font-bold text-purple-600">
            {product.tier.icon} {product.tier.name}
          </span>
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 font-bold text-blue-600">
            {product.category.icon} {product.category.name}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[10px]">
          <span className="text-gray-500">
            التكلفة: <strong className="text-gray-900">{product.costPrice}</strong>
          </span>
          <span
            className={
              product.available > 0
                ? "text-green-600 font-bold"
                : "text-red-600 font-bold"
            }
          >
            متاح: {product.available}
          </span>
        </div>
      </div>
    </button>
  );
}

// ═══════ Modal: تعيين هدية ═══════
function AssignGiftModal({
  reward,
  products,
  onClose,
  onSaved,
}: {
  reward: Reward;
  products: GiftProduct[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // فلترة: منتجات نفس المستوى ونفس الفئة
  const eligible = products.filter(
    (p) =>
      p.isActive &&
      p.tier.id === reward.tier.id &&
      p.available > 0 &&
      (!reward.category || p.category.id === reward.category.id)
  );

  async function save() {
    if (!selectedId) {
      setErr("اختر منتجاً");
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/loyalty/rewards/${reward.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          giftProductId: selectedId,
          status: "PROCESSING",
        }),
      });
      const d = await res.json();
      if (!d.success) {
        setErr(d.message || "فشل");
        return;
      }
      onSaved();
    } catch {
      setErr("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">تعيين هدية</h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs">
          <div className="font-bold text-gray-700">
            {reward.customer.name} · {reward.tier.icon} {reward.tier.name}
          </div>
          {reward.category && (
            <div className="mt-1 text-gray-500">
              الفئة المختارة: {reward.category.icon} {reward.category.name}
            </div>
          )}
        </div>

        {eligible.length === 0 ? (
          <div className="rounded-lg bg-amber-50 p-4 text-center text-xs text-amber-800">
            لا توجد منتجات هدايا متاحة لهذا المستوى وهذه الفئة.
            <br />
            أضف منتج هدية أولاً من تبويب "منتجات الهدايا".
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {eligible.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-right transition ${
                  selectedId === p.id
                    ? "border-[#ff5c00] bg-[#fff4ed]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="h-12 w-full overflow-hidden rounded bg-gray-50">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xl">
                      🎁
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-bold">{p.name}</div>
                <div className="text-[10px] text-gray-500">
                  متاح: {p.available}
                </div>
              </button>
            ))}
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {err}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={save}
            disabled={loading || !selectedId}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            تعيين وقبول
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-bold text-gray-700"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════ Modal: منتج هدية ═══════
function ProductModal({
  product,
  tiers,
  categories,
  onClose,
  onSaved,
}: {
  product: GiftProduct | null;
  tiers: Tier[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !product;

  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    imageUrl: product?.imageUrl || "",
    tierId: product?.tier.id?.toString() || tiers[0]?.id?.toString() || "",
    categoryId:
      product?.category.id?.toString() || categories[0]?.id?.toString() || "",
    costPrice: product?.costPrice?.toString() || "",
    salePrice: product?.salePrice?.toString() || "",
    stock: product?.stock?.toString() || "0",
    isActive: product?.isActive ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.name.trim() || form.name.length < 2) {
      setErr("الاسم مطلوب");
      return;
    }
    if (!form.costPrice || Number(form.costPrice) <= 0) {
      setErr("التكلفة مطلوبة");
      return;
    }
    if (!form.tierId || !form.categoryId) {
      setErr("المستوى والفئة مطلوبان");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const body: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        tierId: Number(form.tierId),
        categoryId: Number(form.categoryId),
        costPrice: Number(form.costPrice),
        salePrice: form.salePrice ? Number(form.salePrice) : null,
        stock: Number(form.stock) || 0,
        isActive: form.isActive,
      };

      const url = isNew
        ? "/api/admin/loyalty/gift-products"
        : `/api/admin/loyalty/gift-products/${product!.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!d.success) {
        setErr(d.message || "فشل الحفظ");
        return;
      }
      onSaved();
    } catch {
      setErr("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct() {
    if (!product) return;
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/loyalty/gift-products/${product.id}`,
        { method: "DELETE" }
      );
      const d = await res.json();
      if (!d.success) {
        setErr(d.message || "فشل الحذف");
        return;
      }
      onSaved();
    } catch {
      setErr("فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">
            {isNew ? "إضافة منتج هدية" : "تعديل منتج هدية"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              اسم المنتج *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              الوصف
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              رابط الصورة
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => update("imageUrl", e.target.value)}
              placeholder="https://..."
              dir="ltr"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs outline-none focus:border-[#ff5c00]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                المستوى *
              </label>
              <select
                value={form.tierId}
                onChange={(e) => update("tierId", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              >
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                الفئة *
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => update("categoryId", e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                التكلفة *
              </label>
              <input
                type="number"
                value={form.costPrice}
                onChange={(e) => update("costPrice", e.target.value)}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                سعر البيع
              </label>
              <input
                type="number"
                value={form.salePrice}
                onChange={(e) => update("salePrice", e.target.value)}
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                المخزون
              </label>
              <input
                type="number"
                value={form.stock}
                onChange={(e) => update("stock", e.target.value)}
                min="0"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#ff5c00]"
            />
            <span className="text-xs font-bold text-gray-700">مفعّل</span>
          </label>
        </div>

        {err && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {err}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={save}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "حفظ"
            )}
          </button>
          {!isNew && (
            <button
              onClick={deleteProduct}
              disabled={loading}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
            >
              حذف
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════ Settings Panel ═══════
function SettingsPanel({
  settings,
  tiers,
  categories,
  onSave,
}: {
  settings: Settings;
  tiers: Tier[];
  categories: Category[];
  onSave: (updates: any) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    isEnabled: settings.isEnabled,
    description: settings.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true);
    setMsg("");
    const ok = await onSave(form);
    setMsg(ok ? "✓ تم الحفظ" : "✗ فشل");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-black">
          <SettingsIcon className="h-4 w-4 text-[#ff5c00]" />
          الإعدادات العامة
        </h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-gray-900">
                نظام الولاء مُفعَّل
              </div>
              <div className="text-[11px] text-gray-500">
                عند الإيقاف، لن يحصل العملاء على نقاط جديدة
              </div>
            </div>
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) =>
                setForm({ ...form, isEnabled: e.target.checked })
              }
              className="h-5 w-5 rounded border-gray-300 text-[#ff5c00]"
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              وصف يظهر للعملاء
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              placeholder="مثال: 5 نقاط لكل 100 درهم. اجمع 1000 نقطة للحصول على مكافأة!"
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#ff5c00]"
            />
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            <strong>قاعدة الحساب الحالية:</strong>
            <br />
            النقاط = القيمة × 0.05 (1% × 5)، مع تقريب: ≥ 0.5 → 1، &lt; 0.5 → 0.
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#ff5c00] py-2.5 text-sm font-bold text-white transition hover:bg-[#e64a00] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "حفظ الإعدادات"
            )}
          </button>

          {msg && (
            <div
              className={`text-center text-xs ${msg.startsWith("✓") ? "text-green-600" : "text-red-600"}`}
            >
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* المستويات */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-black">
          <Trophy className="h-4 w-4 text-[#ff5c00]" />
          المستويات ({tiers.length})
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {tiers.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
            >
              <div className="text-2xl">{t.icon || "🎁"}</div>
              <div>
                <div className="text-xs font-bold">{t.name}</div>
                <div className="text-[10px] text-gray-500">
                  {t.requiredPoints} نقطة · {t.giftProductsCount} هدية
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الفئات */}
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-black">
          <Package className="h-4 w-4 text-[#ff5c00]" />
          فئات الهدايا ({categories.length})
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs"
            >
              <span className="text-lg">{c.icon || "🎁"}</span>
              <div>
                <div className="font-bold">{c.name}</div>
                <div className="text-[10px] text-gray-500">
                  {c.giftProductsCount} منتج
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}