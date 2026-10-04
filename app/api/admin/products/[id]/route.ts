import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const ATTR_ORDER = [{ order: "asc" as const }, { id: "asc" as const }];
const VALUE_ORDER = [{ order: "asc" as const }, { id: "asc" as const }];

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

function cartesian(lists: number[][]): number[][] {
  if (lists.length === 0) return [[]];
  return lists.reduce<number[][]>(
    (acc, list) => {
      const next: number[][] = [];
      for (const e of acc) for (const v of list) next.push([...e, v]);
      return next;
    },
    [[]]
  );
}

function makeHash(ids: number[]): string {
  if (ids.length === 0) return "DEFAULT";
  return [...ids].sort((a, b) => a - b).join("|");
}

// ⭐ إصلاح المفاتيح القديمة (غير مرتّبة)
function normalizeHash(hash: string): string {
  if (!hash || hash === "DEFAULT") return hash;
  const parts = hash
    .split("|")
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n));
  if (parts.length === 0) return hash;
  return [...parts].sort((a, b) => a - b).join("|");
}

// ═══════ GET ═══════
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { orderBy: { order: "asc" } },
        options: {
          orderBy: ATTR_ORDER,
          include: { values: { orderBy: VALUE_ORDER } },
        },
        variants: {
          where: { isActive: true },
          orderBy: [{ isDefault: "desc" }, { id: "asc" }],
          include: {
            inventory: { select: { quantity: true } },
            optionValues: {
              include: {
                optionValue: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    const selectedValues: Record<number, number[]> = {};
    const variantData: Record<string, { price: number; stock: number }> = {};

    const attrIds = product.options
      .map((o) => o.categoryAttributeId)
      .filter((x): x is number => x !== null);

    const categoryAttrs = await prisma.categoryAttribute.findMany({
      where: { id: { in: attrIds } },
      orderBy: ATTR_ORDER,
      include: { values: { orderBy: VALUE_ORDER } },
    });

    const valueLookup = new Map<string, number>();
    for (const attr of categoryAttrs) {
      for (const v of attr.values) {
        valueLookup.set(`${attr.id}:${v.value}`, v.id);
      }
    }

    const povToCatValMap = new Map<number, number>();
    for (const opt of product.options) {
      if (!opt.categoryAttributeId) continue;
      for (const pov of opt.values) {
        const catValId = valueLookup.get(
          `${opt.categoryAttributeId}:${pov.value}`
        );
        if (catValId) povToCatValMap.set(pov.id, catValId);
      }
    }

    for (const attr of categoryAttrs) {
      const opt = product.options.find(
        (o) => o.categoryAttributeId === attr.id
      );
      if (!opt) continue;
      const ids: number[] = [];
      for (const pov of opt.values) {
        const vid = valueLookup.get(`${attr.id}:${pov.value}`);
        if (vid) ids.push(vid);
      }
      if (ids.length > 0) {
        selectedValues[attr.id] = ids;
      }
    }

    // ⭐ نبني variantData بمفاتيح مرتّبة (متوافقة مع المحرر)
    for (const v of product.variants) {
      const catValIds = v.optionValues
        .map((ov) => povToCatValMap.get(ov.optionValueId))
        .filter((x): x is number => x !== undefined);

      const hash = makeHash(catValIds);

      variantData[hash] = {
        price: Number(v.price),
        stock: v.inventory?.quantity ?? 0,
      };
    }

    const defaultVariant =
      product.variants.find((v) => v.isDefault) || product.variants[0];

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description || "",
        brand: product.brand || "",
        badge: product.badge || "",
        categoryId: product.categoryId.toString(),
        price: defaultVariant ? Number(defaultVariant.price) : 0,
        oldPrice: 0,
        stock: defaultVariant?.inventory?.quantity ?? 0,
        imageUrls: product.images.map((img) => img.url),
        freeShipping: product.freeShipping,
        selectedValues,
        variantData,
      },
    });
  } catch (error) {
    console.error("Product GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ PATCH ═══════
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { id } = await params;
    const productId = parseInt(id);
    const body = await request.json();

    const [existing, existingVariantsRaw, categoryAttrs] = await Promise.all([
      prisma.product.findUnique({ where: { id: productId } }),
      prisma.productVariant.findMany({
        where: { productId },
        select: {
          id: true,
          optionsHash: true,
          _count: { select: { orderItems: true } },
        },
      }),
      prisma.categoryAttribute.findMany({
        where: { categoryId: body.categoryId, isActive: true },
        orderBy: ATTR_ORDER,
        include: { values: { orderBy: VALUE_ORDER } },
      }),
    ]);

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "المنتج غير موجود" },
        { status: 404 }
      );
    }

    if (body.slug && body.slug !== existing.slug) {
      const dup = await prisma.product.findFirst({
        where: {
          sellerId: existing.sellerId,
          slug: body.slug,
          deletedAt: null,
          id: { not: productId },
        },
        select: { id: true },
      });
      if (dup) {
        return NextResponse.json(
          { success: false, message: "الرابط (slug) مستخدم" },
          { status: 400 }
        );
      }
    }

    const selectedValues: Record<string, number[]> = body.selectedValues || {};
    const variantData: Record<string, { price?: number; stock?: number }> =
      body.variantData || {};

    type ActiveAttr = {
      attributeId: number;
      name: string;
      order: number;
      values: Array<{ id: number; value: string; order: number }>;
    };

    const activeAttrs: ActiveAttr[] = [];

    for (const attr of categoryAttrs) {
      const ids = selectedValues[String(attr.id)] || [];
      if (ids.length === 0) continue;
      const vals: Array<{ id: number; value: string; order: number }> = [];
      ids.forEach((vid, idx) => {
        const found = attr.values.find((v) => v.id === vid);
        if (found) {
          vals.push({ id: found.id, value: found.value, order: idx });
        }
      });
      if (vals.length > 0) {
        activeAttrs.push({
          attributeId: attr.id,
          name: attr.name,
          order: attr.order,
          values: vals,
        });
      }
    }

    const valueLists = activeAttrs.map((a) => a.values.map((v) => v.id));
    const combos = cartesian(valueLists);

    if (combos.length > 100) {
      return NextResponse.json(
        {
          success: false,
          message: `عدد التركيبات كبير جداً (${combos.length}). الحد 100.`,
        },
        { status: 400 }
      );
    }

    const basePrice = Number(body.price);
    const oldPrice = body.oldPrice ? Number(body.oldPrice) : null;
    const baseStock = Math.max(0, Number(body.stock) || 0);

    // ⭐ تطبيع مفاتيح DB القديمة
    const existingByHash = new Map<
      string,
      { id: number; optionsHash: string; _count: { orderItems: number } }
    >();
    for (const v of existingVariantsRaw) {
      const normalized = normalizeHash(v.optionsHash);
      existingByHash.set(normalized, v);
    }

    // ⭐ تطبيع مفاتيح variantData القادمة من العميل (احتياطي)
    const normalizedVariantData: Record<
      string,
      { price?: number; stock?: number }
    > = {};
    for (const [k, val] of Object.entries(variantData)) {
      normalizedVariantData[normalizeHash(k)] = val;
    }

    const toUpdate: Array<{
      variantId: number;
      combo: number[];
      hash: string;
      price: number;
      stock: number;
      isDefault: boolean;
    }> = [];
    const toCreate: Array<{
      combo: number[];
      hash: string;
      price: number;
      stock: number;
      isDefault: boolean;
    }> = [];

    const newHashes = new Set<string>();

    combos.forEach((combo, i) => {
      const hash = makeHash(combo);
      newHashes.add(hash);

      const custom = normalizedVariantData[hash] || {};
      const price = custom.price ?? basePrice;
      const stock = custom.stock ?? baseStock;
      const isDefault = i === 0;

      const existingVar = existingByHash.get(hash);
      if (existingVar) {
        toUpdate.push({
          variantId: existingVar.id,
          combo,
          hash,
          price,
          stock,
          isDefault,
        });
      } else {
        toCreate.push({ combo, hash, price, stock, isDefault });
      }
    });

    await prisma.$transaction(
      async (tx) => {
        await tx.product.update({
          where: { id: productId },
          data: {
            name: body.name,
            slug: body.slug,
            description: body.description || null,
            brand: body.brand || null,
            badge: body.badge || null,
            freeShipping: body.freeShipping ?? false,
            categoryId: body.categoryId,
          },
        });

        if (Array.isArray(body.imageUrls)) {
          const cleanUrls = body.imageUrls.filter(
            (u: any): u is string =>
              typeof u === "string" && u.trim().length > 0
          );
          await tx.productImage.deleteMany({ where: { productId } });
          if (cleanUrls.length > 0) {
            await tx.productImage.createMany({
              data: cleanUrls.map((url: string, idx: number) => ({
                productId,
                url: url.trim(),
                order: idx,
                isMain: idx === 0,
              })),
            });
          }
        }

        await tx.productVariantOptionValue.deleteMany({
          where: { variant: { productId } },
        });
        await tx.productOption.deleteMany({ where: { productId } });

        if (combos.length === 1 && combos[0].length === 0) {
          const d = normalizedVariantData["DEFAULT"] || {};
          if (existingByHash.has("DEFAULT")) {
            const v = existingByHash.get("DEFAULT")!;
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                price: d.price ?? basePrice,
                originalPrice: basePrice,
                discountPrice: oldPrice,
                isActive: true,
                isDefault: true,
              },
            });
            await tx.inventory.upsert({
              where: { variantId: v.id },
              update: { quantity: d.stock ?? baseStock },
              create: {
                variantId: v.id,
                quantity: d.stock ?? baseStock,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              },
            });
          } else {
            const created = await tx.productVariant.create({
              data: {
                productId,
                sellerId: existing.sellerId,
                sku: `${body.slug}-default-${Date.now()}`,
                price: d.price ?? basePrice,
                originalPrice: basePrice,
                discountPrice: oldPrice,
                isDefault: true,
                isActive: true,
                optionsHash: "DEFAULT",
              },
              select: { id: true },
            });
            await tx.inventory.create({
              data: {
                variantId: created.id,
                quantity: d.stock ?? baseStock,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              },
            });
          }
        } else {
          const povMap = new Map<number, number>();

          for (const attr of activeAttrs) {
            const created = await tx.productOption.create({
              data: {
                productId,
                categoryAttributeId: attr.attributeId,
                name: attr.name,
                order: attr.order,
                values: {
                  create: attr.values.map((v) => ({
                    value: v.value,
                    order: v.order,
                  })),
                },
              },
              include: { values: { orderBy: { order: "asc" } } },
            });
            attr.values.forEach((v, idx) => {
              povMap.set(v.id, created.values[idx].id);
            });
          }

          if (toUpdate.length > 0) {
            await Promise.all(
              toUpdate.map((u) =>
                tx.productVariant.update({
                  where: { id: u.variantId },
                  data: {
                    price: u.price,
                    originalPrice: basePrice,
                    discountPrice: oldPrice,
                    isActive: true,
                    isDefault: u.isDefault,
                    optionsHash: u.hash, // ⭐ تحديث الـhash ليكون مرتّباً
                  },
                })
              )
            );

            await Promise.all(
              toUpdate.map((u) =>
                tx.inventory.upsert({
                  where: { variantId: u.variantId },
                  update: { quantity: u.stock },
                  create: {
                    variantId: u.variantId,
                    quantity: u.stock,
                    reservedQuantity: 0,
                    lowStockThreshold: 5,
                  },
                })
              )
            );
          }

          let createdVariants: Array<{ id: number }> = [];
          if (toCreate.length > 0) {
            const ts = Date.now();
            createdVariants = await tx.productVariant.createManyAndReturn({
              data: toCreate.map((c, i) => ({
                productId,
                sellerId: existing.sellerId,
                sku: `${body.slug}-${i}-${ts}`,
                price: c.price,
                originalPrice: basePrice,
                discountPrice: oldPrice,
                isDefault: c.isDefault,
                isActive: true,
                optionsHash: c.hash,
              })),
              select: { id: true },
            });

            await tx.inventory.createMany({
              data: createdVariants.map((v, i) => ({
                variantId: v.id,
                quantity: toCreate[i].stock,
                reservedQuantity: 0,
                lowStockThreshold: 5,
              })),
            });
          }

          const allLinks: Array<{
            variantId: number;
            optionValueId: number;
          }> = [];

          for (const u of toUpdate) {
            for (const cvId of u.combo) {
              const povId = povMap.get(cvId);
              if (povId)
                allLinks.push({
                  variantId: u.variantId,
                  optionValueId: povId,
                });
            }
          }

          for (let i = 0; i < toCreate.length; i++) {
            const v = createdVariants[i];
            for (const cvId of toCreate[i].combo) {
              const povId = povMap.get(cvId);
              if (povId)
                allLinks.push({ variantId: v.id, optionValueId: povId });
            }
          }

          if (allLinks.length > 0) {
            const BATCH = 1000;
            for (let i = 0; i < allLinks.length; i += BATCH) {
              await tx.productVariantOptionValue.createMany({
                data: allLinks.slice(i, i + BATCH),
              });
            }
          }
        }

        const toDeactivate: number[] = [];
        const toDelete: number[] = [];

        for (const v of existingVariantsRaw) {
          const normalized = normalizeHash(v.optionsHash);
          if (newHashes.has(normalized)) continue;
          if (v._count.orderItems > 0) toDeactivate.push(v.id);
          else toDelete.push(v.id);
        }

        if (toDeactivate.length > 0) {
          await tx.productVariant.updateMany({
            where: { id: { in: toDeactivate } },
            data: { isActive: false },
          });
        }
        if (toDelete.length > 0) {
          await tx.productVariant.deleteMany({
            where: { id: { in: toDelete } },
          });
        }
      },
      { timeout: 60000, maxWait: 15000 }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

// ═══════ DELETE ═══════
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }
    const { id } = await params;
    await prisma.product.update({
      where: { id: parseInt(id) },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Product delete error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}