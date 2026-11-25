const CUR = "د.م";

export const REASON_TYPE_LABELS: Record<string, string> = {
  DEFECTIVE: "منتج معيب أو مكسور",
  WRONG_ITEM: "منتج خاطئ",
  MISSING_ITEM: "منتج ناقص",
  LOST: "ضاع في الشحن",
  CHANGED_MIND: "غيّر رأيه",
};

export function reasonTypeLabel(t?: string | null): string {
  if (!t) return "";
  return REASON_TYPE_LABELS[t] ?? "";
}

function money(n: string | number | null | undefined): string {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? String(v) : "0";
}

// ما يراه العميل عن شحن الإرجاع (يظهر بعد إتمام الإرجاع)
export function payerLabelForCustomer(payer?: string | null, fee?: string | number | null): string {
  switch (payer) {
    case "CUSTOMER":
      return `رسوم شحن الإرجاع: ${money(fee)} ${CUR} (خُصمت من المبلغ المسترجع)`;
    case "SELLER":
      return "شحن الإرجاع: مجاني، تكفّل به المتجر";
    case "PLATFORM":
      return "شحن الإرجاع: مجاني بفضل بطاقة الإرجاع المجانية";
    case "NONE":
      return "شحن الإرجاع: مجاني";
    default:
      return "";
  }
}

// ما يراه التاجر عن شحن الإرجاع
export function payerLabelForSeller(payer?: string | null, fee?: string | number | null): string {
  switch (payer) {
    case "SELLER":
      return `الشحن عليك: ${money(fee)} ${CUR} (يُخصم من محفظتك)`;
    case "CUSTOMER":
      return "الشحن على العميل";
    case "PLATFORM":
      return "الشحن على المنصة";
    default:
      return "";
  }
}

// مهلة قرار الإرجاع (48 ساعة)
export function deadlineBadge(
  due: string | Date | null | undefined,
  now: number = Date.now()
): { overdue: boolean; label: string } | null {
  if (!due) return null;
  const t = new Date(due).getTime();
  if (!Number.isFinite(t)) return null;
  if (t <= now) return { overdue: true, label: "تجاوز مهلة 48 ساعة" };
  const hours = Math.ceil((t - now) / (60 * 60 * 1000));
  return { overdue: false, label: `متبقّي ${hours} ساعة` };
}