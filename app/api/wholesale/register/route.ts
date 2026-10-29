import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";

const supplierFields = {
  displayName: z.string().trim().min(2).max(120),
  activityType: z.enum([
    "COMPANY",
    "WORKSHOP",
    "FACTORY",
    "WAREHOUSE",
    "SHOP",
    "DISTRIBUTOR",
    "INDEPENDENT",
  ]),
  city: z.string().trim().min(2).max(80),
  region: z.string().trim().max(80).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  logo: z.string().url().optional().nullable(),
};

const guestSchema = z.object({
  mode: z.literal("guest"),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().min(6).max(20).optional().nullable(),
  ...supplierFields,
});

const loggedSchema = z.object({
  mode: z.literal("logged"),
  ...supplierFields,
});

const schema = z.discriminatedUnion("mode", [guestSchema, loggedSchema]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s\u0600-\u06FF-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 60);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base || "supplier";
  let counter = 1;
  while (await prisma.wholesaleSupplier.findUnique({ where: { slug } })) {
    slug = `${base}-${counter}`;
    counter++;
    if (counter > 100) throw new Error("تعذر إنشاء رابط فريد");
  }
  return slug;
}

export async function POST(request: Request) {
  try {
    const current = await SessionService.getCurrent();
    const body = await request.json();

    // Inject mode based on session
    if (!body.mode) {
      body.mode = current ? "logged" : "guest";
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // ═══ Logged-in path ═══
    if (data.mode === "logged") {
      if (!current) {
        return NextResponse.json(
          { success: false, message: "غير مصرح" },
          { status: 401 }
        );
      }

      // Check if user already has a supplier
      const existing = await prisma.wholesaleSupplier.findUnique({
        where: { userId: current.user.id },
        select: { id: true, status: true },
      });
      if (existing) {
        return NextResponse.json(
          {
            success: false,
            message: "لديك حساب جملة بالفعل",
            supplierId: existing.id,
            status: existing.status,
          },
          { status: 409 }
        );
      }

      const slug = await ensureUniqueSlug(slugify(data.displayName));

      const supplier = await prisma.wholesaleSupplier.create({
        data: {
          userId: current.user.id,
          displayName: data.displayName.trim(),
          slug,
          activityType: data.activityType,
          city: data.city.trim(),
          region: data.region?.trim() || null,
          description: data.description?.trim() || null,
          logo: data.logo || null,
          status: "PENDING",
        },
        select: { id: true, slug: true, displayName: true, status: true },
      });

      return NextResponse.json({ success: true, supplier });
    }

    // ═══ Guest path — create User + Supplier ═══
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message:
            "البريد الإلكتروني مسجل بالفعل. سجّل دخولك ثم أنشئ حساب الجملة من لوحتك.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const slug = await ensureUniqueSlug(slugify(data.displayName));

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email,
          phone: data.phone?.trim() || null,
          passwordHash,
          role: "SELLER",
          emailVerified: false, // must verify via email
        },
        select: { id: true, name: true, email: true },
      });

      const supplier = await tx.wholesaleSupplier.create({
        data: {
          userId: user.id,
          displayName: data.displayName.trim(),
          slug,
          activityType: data.activityType,
          city: data.city.trim(),
          region: data.region?.trim() || null,
          description: data.description?.trim() || null,
          logo: data.logo || null,
          status: "PENDING",
        },
        select: { id: true, slug: true, displayName: true, status: true },
      });

      return { user, supplier };
    });

    // Create session for auto-login
    await SessionService.create(result.user.id);

    return NextResponse.json(
      { success: true, supplier: result.supplier, created: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("Wholesale register error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ أثناء التسجيل" },
      { status: 500 }
    );
  }
}