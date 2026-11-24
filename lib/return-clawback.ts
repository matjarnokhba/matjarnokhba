// حساب ما يُسترد من التاجر عند إرجاع العميل لقطع بعد التسليم

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeClawback(i: {
  commission: number;
  sellerPayout: number;
  refundedCommission: number;
  prevNet: number;
  isFull: boolean;
  items: { unitPrice: number; qty: number; subsidyShare: number }[];
}) {
  const base = r2(i.commission + i.sellerPayout);
  const returnedValue = r2(i.items.reduce((s, x) => s + x.unitPrice * x.qty + x.subsidyShare, 0));
  const subsidyBack = r2(i.items.reduce((s, x) => s + x.subsidyShare, 0));
  const remNet = Math.max(0, r2(i.sellerPayout - i.prevNet));
  const remComm = Math.max(0, r2(i.commission - i.refundedCommission));
  if (base <= 0) return { returnedValue, subsidyBack, netBack: 0, commissionBack: 0 };

  if (i.isFull) {
    // إرجاع كامل: نعكس كل ما تبقى بلا فروق تقريب
    return { returnedValue, subsidyBack, netBack: remNet, commissionBack: remComm };
  }
  const ratio = Math.min(1, returnedValue / base);
  return {
    returnedValue,
    subsidyBack,
    netBack: Math.min(remNet, r2(i.sellerPayout * ratio)),
    commissionBack: Math.min(remComm, r2(i.commission * ratio)),
  };
}