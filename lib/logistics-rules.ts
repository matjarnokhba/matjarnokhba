export const COMPANY_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["SUSPENDED", "DETACHING"],
  SUSPENDED: ["ACTIVE", "DETACHING"],
  DETACHING: ["DETACHED", "ACTIVE"],
  DETACHED: ["ACTIVE"],
};

export const WAREHOUSE_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["SUSPENDED", "CLOSED"],
  SUSPENDED: ["ACTIVE", "CLOSED"],
  CLOSED: ["ACTIVE"],
};

export function canTransition(
  map: Record<string, string[]>,
  from: string,
  to: string
): boolean {
  return (map[from] ?? []).includes(to);
}

/** جزء رمز ASCII من اسم (للتوليد التلقائي لرموز المستودعات والشركات). */
export function codePart(seed: string): string {
  const s = (seed || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return s.length > 0 ? s : "GEN";
}