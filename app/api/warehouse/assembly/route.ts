import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { AssemblyService } from "@/services/assembly.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "ACTIVE";
    const city = searchParams.get("city") || "ALL";
    const search = searchParams.get("q")?.trim().toLowerCase() || "";

    // ═══ 1. Lazy: ensure assemblies for orders needing them ═══
    const ordersNeedingAssembly = await prisma.order.findMany({
      where: {
        assemblyFile: null,
        items: { some: { fulfillmentItems: { some: {} } } },
      },
      select: { id: true },
      take: 200,
    });

    for (const o of ordersNeedingAssembly) {
      try {
        await prisma.$transaction(async (tx) => {
          await AssemblyService.ensureForOrder(tx, o.id);
        });
      } catch (err) {
        console.error(`Ensure assembly for order ${o.id} failed:`, err);
      }
    }

    // ═══ 2. Recompute active assemblies ═══
    const activeAssemblies = await prisma.assemblyFile.findMany({
      where: {
        status: { in: ["PENDING", "READY", "PARTIALLY_SHIPPED"] },
      },
      select: { id: true },
    });

    for (const a of activeAssemblies) {
      try {
        await prisma.$transaction(async (tx) => {
          await AssemblyService.recompute(tx, a.id);
        });
      } catch (err) {
        console.error(`Recompute assembly ${a.id} failed:`, err);
      }
    }

    // ═══ 3. Query ═══
    const where: any = {};
    if (status === "ACTIVE") {
      where.status = { in: ["PENDING", "READY", "PARTIALLY_SHIPPED"] };
    } else if (status === "COMPLETED") {
      where.status = "COMPLETED";
    } else if (status !== "ALL") {
      where.status = status;
    }
    if (city !== "ALL") where.deliveryCity = city;

    const assemblies = await prisma.assemblyFile.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerSnapshot: true,
            shippingAddressSnapshot: true,
            total: true,
          },
        },
        user: { select: { id: true, name: true, phone: true, email: true } },
        items: {
          include: {
            fulfillmentItem: {
              select: {
                id: true,
                status: true,
                quantity: true,
                sellerId: true,
                orderItem: {
                  select: {
                    id: true,
                    productName: true,
                    variantName: true,
                    imageUrl: true,
                    quantity: true,
                    sellerId: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    // ═══ 4. Search filter (in memory) ═══
    let filtered = assemblies;
    if (search) {
      filtered = assemblies.filter((a) => {
        const cust = (a.order.customerSnapshot || {}) as any;
        return (
          a.assemblyCode.toLowerCase().includes(search) ||
          a.order.orderNumber.toLowerCase().includes(search) ||
          a.user.name.toLowerCase().includes(search) ||
          (cust?.name || "").toLowerCase().includes(search) ||
          (cust?.phone || "").includes(search)
        );
      });
    }

    // ═══ 5. Cities ═══
    const cityRows = await prisma.assemblyFile.findMany({
      where: {
        status: { in: ["PENDING", "READY", "PARTIALLY_SHIPPED"] },
        deliveryCity: { not: null },
      },
      select: { deliveryCity: true },
      distinct: ["deliveryCity"],
    });
    const cities = cityRows
      .map((r) => r.deliveryCity)
      .filter((c): c is string => !!c);

    // ═══ Serialize ═══
    const serialized = JSON.parse(
      JSON.stringify(filtered, (_, v) => {
        if (typeof v === "bigint") return v.toString();
        if (
          v !== null &&
          typeof v === "object" &&
          typeof v.toNumber === "function" &&
          typeof v.toFixed === "function"
        ) {
          return v.toNumber();
        }
        return v;
      })
    );

    return NextResponse.json({
      success: true,
      assemblies: serialized,
      cities,
    });
  } catch (error) {
    console.error("Assembly list error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}