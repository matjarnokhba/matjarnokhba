import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireDelivery() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "DELIVERY") {
    return { error: "غير مصرح", status: 403 };
  }

  const person = await prisma.deliveryPerson.findUnique({
    where: { userId: current.user.id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!person || person.deletedAt || person.status !== "ACTIVE") {
    return { error: "الحساب غير نشط", status: 403 };
  }

  return { user: current.user, person };
}

export async function GET(request: Request) {
  try {
    const auth = await requireDelivery();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status") || "ACTIVE";

    let statuses: string[];
    if (statusFilter === "ACTIVE") {
      statuses = ["ASSIGNED", "IN_PROGRESS"];
    } else if (statusFilter === "COMPLETED") {
      statuses = ["COMPLETED", "CANCELLED"];
    } else {
      statuses = [statusFilter];
    }

    const assignments = await prisma.collectionAssignment.findMany({
      where: {
        deliveryPersonId: auth.person.id,
        status: { in: statuses as any },
      },
      include: {
        items: {
          include: {
            fulfillmentItem: {
              include: {
                seller: {
                  select: {
                    id: true,
                    storeName: true,
                    city: true,
                    region: true,
                  },
                },
                orderItem: {
                  include: {
                    product: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    });

    const formatted = assignments.map((a) => {
      const collectedCount = a.items.filter((i) => i.collectedAt).length;
      const sellerCities = [
        ...new Set(
          a.items
            .map((i) => i.fulfillmentItem.seller.city)
            .filter((c): c is string => !!c)
        ),
      ];

      return {
        id: a.id,
        assignmentNumber: a.assignmentNumber,
        status: a.status,
        scheduledAt: a.scheduledAt,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
        createdAt: a.createdAt,
        itemsCount: a.items.length,
        collectedCount,
        sellersCount: new Set(a.items.map((i) => i.sellerId)).size,
        cities: sellerCities,
      };
    });

    const stats = {
      active: formatted.filter((a) =>
        ["ASSIGNED", "IN_PROGRESS"].includes(a.status)
      ).length,
      completed: formatted.filter((a) => a.status === "COMPLETED").length,
      total: formatted.length,
    };

    return NextResponse.json({ success: true, assignments: formatted, stats });
  } catch (error) {
    console.error("Delivery collections GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}