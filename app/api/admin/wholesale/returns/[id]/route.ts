import {
  requireAdmin,
  handleError,
  ok,
  fail,
  numericParam,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const returnId = numericParam(id);
    if (!returnId) return fail("معرف غير صحيح", 400);

    const returnOrder = await prisma.returnOrder.findUnique({
      where: { id: returnId },
      include: {
        items: {
          include: {
            originalOrderItem: {
              select: {
                id: true,
                productName: true,
                unitPrice: true,
                quantity: true,
                subtotal: true,
              },
            },
            inventoryReturns: {
              select: {
                id: true,
                inventoryLedgerId: true,
                condition: true,
                quantity: true,
                sourceBatchId: true,
              },
            },
          },
        },
        creditNotes: {
          select: { id: true, amount: true, reasonCode: true, issuedAt: true },
        },
        originalOrder: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            deliveredAt: true,
          },
        },
      },
    });

    if (!returnOrder) return fail("المرتجع غير موجود", 404);

    // Enrich with BU info
    const bus = await prisma.businessUnit.findMany({
      where: {
        id: {
          in: [
            returnOrder.buyerBusinessUnitId,
            returnOrder.sellerBusinessUnitId,
          ],
        },
      },
      select: { id: true, name: true, slug: true, type: true },
    });

    return ok({ returnOrder, businessUnits: bus });
  } catch (err) {
    return handleError(err, "GET /admin/wholesale/returns/[id]");
  }
}