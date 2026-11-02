/**
 * Wholesale System - Error Types
 */

export class WholesaleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly httpStatus: number = 400,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "WholesaleError";
  }
}

export class ValidationError extends WholesaleError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends WholesaleError {
  constructor(entity: string, id: number | string) {
    super(entity + " غير موجود (#" + id + ")", "NOT_FOUND", 404, { entity, id });
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends WholesaleError {
  constructor(message: string = "غير مصرح") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends WholesaleError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
    this.name = "ConflictError";
  }
}

export class InsufficientStockError extends WholesaleError {
  constructor(productName: string, requested: number, available: number) {
    super(
      "المخزون غير كافٍ لـ " + productName + ": طلبت " + requested + "، متاح " + available,
      "INSUFFICIENT_STOCK",
      409,
      { productName, requested, available }
    );
    this.name = "InsufficientStockError";
  }
}

export class ReservationExpiredError extends WholesaleError {
  constructor() {
    super("انتهت صلاحية الحجز - أعد المحاولة", "RESERVATION_EXPIRED", 410);
    this.name = "ReservationExpiredError";
  }
}

export class InvalidStateTransitionError extends WholesaleError {
  constructor(from: string, to: string) {
    super("لا يمكن الانتقال من " + from + " إلى " + to, "INVALID_TRANSITION", 400, { from, to });
    this.name = "InvalidStateTransitionError";
  }
}

export class IdempotencyConflictError extends WholesaleError {
  constructor(key: string) {
    super("طلب سابق قيد التنفيذ بنفس المعرّف", "IDEMPOTENCY_CONFLICT", 409, { key });
    this.name = "IdempotencyConflictError";
  }
}

export class UnbalancedLedgerError extends WholesaleError {
  constructor(debit: number, credit: number) {
    super("قيد محاسبي غير متوازن: مدين " + debit + " ≠ دائن " + credit, "UNBALANCED_LEDGER", 500, { debit, credit });
    this.name = "UnbalancedLedgerError";
  }
}

export function isWholesaleError(err: unknown): err is WholesaleError {
  return err instanceof WholesaleError;
}

export function toHttpResponse(err: unknown): { status: number; body: unknown } {
  if (isWholesaleError(err)) {
    return {
      status: err.httpStatus,
      body: { success: false, code: err.code, message: err.message, details: err.details },
    };
  }
  return {
    status: 500,
    body: { success: false, code: "INTERNAL_ERROR", message: "حدث خطأ غير متوقع" },
  };
}
