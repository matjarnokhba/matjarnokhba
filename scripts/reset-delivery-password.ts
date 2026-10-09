import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const NEW_PASSWORD = "Driver@2026"; // ← غيّرها إن أردت

async function main() {
  console.log("🔍 جلب قائمة السائقين...\n");

  const persons = await prisma.deliveryPerson.findMany({
    where: { deletedAt: null },
    include: {
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });

  if (persons.length === 0) {
    console.log("❌ لا يوجد سائقون");
    return;
  }

  console.log(`📋 عدد السائقين: ${persons.length}\n`);

  for (const p of persons) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 ${p.user.name}`);
    console.log(`📧 ${p.user.email}`);
    console.log(`📞 ${p.user.phone || "—"}`);
    console.log(`🆔 DeliveryPerson ID: ${p.id}`);
    console.log(`🆔 User ID: ${p.userId}`);
    console.log(`📍 ${p.city}`);
    console.log(`📊 الحالة: ${p.status}`);
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // ═══ إعادة تعيين كلمة المرور للسائق الأول ═══
  const target = persons[0];
  console.log(
    `🔐 إعادة تعيين كلمة المرور للسائق: ${target.user.name}`
  );

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 12);

  await prisma.user.update({
    where: { id: target.userId },
    data: { passwordHash },
  });

  console.log(`✅ تم التعيين بنجاح!\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📧 البريد: ${target.user.email}`);
  console.log(`🔑 كلمة المرور: ${NEW_PASSWORD}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});