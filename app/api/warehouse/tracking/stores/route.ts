import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

async function requireWarehouse() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  const allowed = ["WAREHOUSE_MANAGER", "ADMIN", "SUPER_ADMIN"];
  if (!allowed.includes(current.user.role)) {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET() {
  try {
    const auth = await requireWarehouse();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const stores = await prisma.seller.findMany({
      where: {
        deletedAt: null,
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        storeName: true,
        slug: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        status: true,
        _count: {
          select: {
            products: true,
            orderItems: true,
          },
        },
      },
      orderBy: [{ city: "asc" }, { storeName: "asc" }],
    });

    const totalStoresRaw = await prisma.seller.count({
      where: { deletedAt: null },
    });

    const rows = stores.map((s) => ({
      id: s.id,
      storeName: s.storeName,
      slug: s.slug,
      city: s.city,
      region: s.region,
      latitude: s.latitude!,
      longitude: s.longitude!,
      status: s.status,
      productsCount: s._count.products,
      ordersCount: s._count.orderItems,
    }));

    return NextResponse.json({
      success: true,
      stores: rows,
      totalStores: totalStoresRaw,
      withLocation: rows.length,
      withoutLocation: totalStoresRaw - rows.length,
    });
  } catch (e) {
    console.error("warehouse tracking stores:", e);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}