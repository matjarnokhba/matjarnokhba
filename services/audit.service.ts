import { prisma } from "@/lib/prisma";

// ═══════ الأنواع ═══════
type AuditActionType =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "STATUS_CHANGE"
  | "PERMISSION_CHANGE"
  | "PAYMENT_CHANGE"
  | "STOCK_ADJUSTMENT"
  | "QR_SCAN"
  | "SHIPMENT_CREATE"
  | "SHIPMENT_UPDATE"
  | "DELIVERY_ASSIGN"
  | "DELIVERY_ACTION";

type LogInput = {
  userId: number | null;
  action: AuditActionType;
  entity: string;
  entityId: string | number;
  oldData?: any;
  newData?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export const AuditService = {
  // ═══ تسجيل عملية ═══
  async log(input: LogInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: String(input.entityId),
          oldData: input.oldData ?? undefined,
          newData: input.newData ?? undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (err) {
      // ═══ لا نُفشل العملية الأصلية إن فشل التدقيق ═══
      console.error("Audit log failed:", err);
    }
  },

  // ═══ تسجيل داخل Transaction ═══
  async logInTransaction(tx: any, input: LogInput): Promise<void> {
    await tx.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: String(input.entityId),
        oldData: input.oldData ?? undefined,
        newData: input.newData ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  },

  // ═══ استخراج IP + UA من Request ═══
  getRequestInfo(request: Request): {
    ipAddress: string | null;
    userAgent: string | null;
  } {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ipAddress = forwarded
      ? forwarded.split(",")[0].trim()
      : realIp || null;
    const userAgent = request.headers.get("user-agent") || null;
    return { ipAddress, userAgent };
  },

  // ═══ استعلام سجل التدقيق (للمراجعة) ═══
  async list(params: {
    entity?: string;
    entityId?: string;
    userId?: number;
    action?: AuditActionType;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = String(params.entityId);
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params.limit || 50,
        skip: params.offset || 0,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return { total, logs };
  },
};