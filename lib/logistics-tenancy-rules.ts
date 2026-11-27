export const PLATFORM_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["SUSPENDED", "REVOKED"],
  SUSPENDED: ["ACTIVE", "REVOKED"],
  REVOKED: ["ACTIVE"],
};

export const LINK_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["PAUSED", "REVOKED"],
  PAUSED: ["ACTIVE", "REVOKED"],
  REVOKED: ["ACTIVE"],
};

/** شحنات يعمل عليها السائق حالياً: لا يجوز نقل السائق لشركة أخرى أثناءها. */
export const ACTIVE_DRIVER_SHIPMENT_STATUSES = ["ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "IN_TRANSIT", "POSTPONED"];

export function canPlatformTransition(from: string, to: string): boolean {
  return (PLATFORM_TRANSITIONS[from] ?? []).includes(to);
}
export function canLinkTransition(from: string, to: string): boolean {
  return (LINK_TRANSITIONS[from] ?? []).includes(to);
}