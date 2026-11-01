import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { slugifyBusiness, ensureUniqueBusinessSlug } from "@/lib/business-slug";
import { slugifySupplyActivity, ensureUniqueSupplyActivitySlug } from "@/lib/supply-activity-slug";

type RegisterInput = {
  accountName: string;
  email: string;
  password: string;
  phone: string;
  supplyActivityType: "FACTORY" | "COMPANY" | "SUPPLIER" | "IMPORTER";
  businessName: string;
  legalName?: string | null;
  city: string;
  address?: string | null;
  commercialRegister?: string | null;
  taxId?: string | null;
  description?: string | null;
};

export const WholesaleRegistrationService = {
  async registerSupplier(input: RegisterInput) {
    // Pre-check email uniqueness
    const existing = await prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new Error("البريد الإلكتروني مسجل بالفعل — سجّل الدخول بدلاً من ذلك");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    return prisma.$transaction(async (tx) => {
      // 1. Create User (role: CUSTOMER — will operate via Business)
      const user = await tx.user.create({
        data: {
          name: input.accountName,
          email: input.email,
          passwordHash,
          phone: input.phone,
          role: "CUSTOMER",
          emailVerified: false,
          referralCode,
        },
      });

      // 2. Create Business (INDEPENDENT_SUPPLIER)
      const baseSlug = slugifyBusiness(input.businessName);
      const bizSlug = await ensureUniqueBusinessSlug(baseSlug);

      const business = await tx.business.create({
        data: {
          type: "INDEPENDENT_SUPPLIER",
          status: "PENDING",
          name: input.businessName,
          legalName: input.legalName ?? null,
          slug: bizSlug,
          description: input.description ?? null,
          commercialRegister: input.commercialRegister ?? null,
          taxId: input.taxId ?? null,
          city: input.city,
          address: input.address ?? null,
          phone: input.phone,
          email: input.email,
          ownerUserId: user.id,
        },
      });

      // 3. Create BusinessMember (OWNER)
      await tx.businessMember.create({
        data: { businessId: business.id, userId: user.id, role: "OWNER" },
      });

      // 4. Create SupplyActivity (matching subtype)
      const saBase = slugifySupplyActivity(input.businessName);
      const saSlug = await ensureUniqueSupplyActivitySlug(saBase, tx);

      const supplyActivity = await tx.supplyActivity.create({
        data: {
          businessId: business.id,
          type: input.supplyActivityType,
          status: "PENDING",
          name: input.businessName,
          slug: saSlug,
          legalName: input.legalName ?? null,
          description: input.description ?? null,
          commercialRegister: input.commercialRegister ?? null,
          taxId: input.taxId ?? null,
          city: input.city,
          address: input.address ?? null,
        },
      });

      return {
        userId: user.id,
        businessId: business.id,
        businessName: business.name,
        supplyActivityId: supplyActivity.id,
        supplyActivityType: supplyActivity.type,
      };
    }, { timeout: 30000 });
  },
};