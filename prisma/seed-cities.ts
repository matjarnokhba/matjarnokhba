import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { MOROCCAN_CITIES } from "../lib/moroccan-cities";
import { getColorHue, getColorHex } from "../lib/address-colors";

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ═══════════════════════════════════════════
// Districts — فقط للمدن الكبرى
// (البحث المحلي للأحياء، والباقي عبر Nominatim)
// ═══════════════════════════════════════════

type DistrictInput = {
  name: string;
  nameFr?: string;
  type?: "NEIGHBORHOOD" | "RURAL" | "DOUAR" | "VILLAGE";
};

const DISTRICTS_BY_SLUG: Record<string, DistrictInput[]> = {
  casablanca: [
    { name: "المعاريف", nameFr: "Maarif" },
    { name: "سيدي بليوط", nameFr: "Sidi Belyout" },
    { name: "الحي الحسني", nameFr: "Hay Hassani" },
    { name: "عين الشق", nameFr: "Ain Chock" },
    { name: "سيدي معروف", nameFr: "Sidi Maârouf" },
    { name: "دار بوعزة", nameFr: "Dar Bouazza" },
    { name: "عين الذياب", nameFr: "Ain Diab" },
    { name: "الألفة", nameFr: "Alfath" },
    { name: "الوفاء", nameFr: "Al Wifaq" },
    { name: "المدينة القديمة", nameFr: "Ancienne Médina" },
    { name: "الحبوس", nameFr: "Habous" },
    { name: "سيدي مومن", nameFr: "Sidi Moumen" },
    { name: "الحي المحمدي", nameFr: "Hay Mohammadi" },
    { name: "بلفدير", nameFr: "Belvédère" },
    { name: "أنفا", nameFr: "Anfa" },
    { name: "بوركون", nameFr: "Bourgogne" },
    { name: "القريان", nameFr: "El Qraya" },
    { name: "غوتييه", nameFr: "Gauthier" },
    { name: "بوسكورة", nameFr: "Bouskoura" },
    { name: "النخيل", nameFr: "Anfa Place" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "الحي الإداري", nameFr: "Quartier Administratif" },
    { name: "ليزونيون", nameFr: "Les Orangers" },
    { name: "التشارك", nameFr: "Tacharouk" },
    { name: "الفرح", nameFr: "Al Farah" },
    { name: "الصخور السوداء", nameFr: "Roches Noires" },
    { name: "الأمل", nameFr: "Al Amal" },
    { name: "حي رحمة", nameFr: "Hay Rahma" },
    { name: "الحي الصناعي", nameFr: "Zone Industrielle" },
    { name: "الحي الجديد", nameFr: "Hay Jadid" },
  ],
  mohammedia: [
    { name: "الحسانية", nameFr: "Al Hassania" },
    { name: "العلويين", nameFr: "Al Alawiyine" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "المركز", nameFr: "Centre" },
    { name: "الحي الحسني", nameFr: "Hay Hassani" },
  ],
  rabat: [
    { name: "أكدال", nameFr: "Agdal" },
    { name: "حسان", nameFr: "Hassan" },
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "السويسي", nameFr: "Souissi" },
    { name: "اليوسفية", nameFr: "Youssoufia" },
    { name: "التقدم", nameFr: "Takaddoum" },
    { name: "الحي الجديد", nameFr: "Hay Nahda" },
    { name: "حي الفتح", nameFr: "Hay El Fath" },
    { name: "الرياض", nameFr: "Riad" },
    { name: "يعقوب المنصور", nameFr: "Yaacoub El Mansour" },
    { name: "الحي الإداري", nameFr: "Quartier Administratif" },
    { name: "المحيط", nameFr: "El Océan" },
    { name: "بترا", nameFr: "Bettana" },
    { name: "أكديال", nameFr: "Oudayas" },
  ],
  sale: [
    { name: "بتابري", nameFr: "Bettana" },
    { name: "تابريكت", nameFr: "Tabriquet" },
    { name: "السلام", nameFr: "Sala Al Jadida" },
    { name: "حي الرحمة", nameFr: "Hay Rahma" },
    { name: "العرجات", nameFr: "Arajar" },
    { name: "الحي الحسني", nameFr: "Hay Hassani" },
    { name: "المرسى", nameFr: "Marina" },
    { name: "شالة", nameFr: "Chellah" },
  ],
  kenitra: [
    { name: "المغرب العربي", nameFr: "Maghreb Arabi" },
    { name: "ميموزا", nameFr: "Mimosa" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "الحي الإداري", nameFr: "Quartier Administratif" },
    { name: "وادي سبو", nameFr: "Oued Sebou" },
  ],
  marrakech: [
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "جليز", nameFr: "Guéliz" },
    { name: "الدوار", nameFr: "Daoudiate" },
    { name: "المسيرة", nameFr: "Massira" },
    { name: "سيدي يوسف بن علي", nameFr: "Sidi Youssef Ben Ali" },
    { name: "المحاميد", nameFr: "Mohamid" },
    { name: "حي الحسني", nameFr: "Hay Hassani" },
    { name: "القصور", nameFr: "Kasbah" },
    { name: "المزار", nameFr: "Mhamid" },
    { name: "أزلي", nameFr: "Azli" },
    { name: "تاركة", nameFr: "Targa" },
    { name: "أمزميز", nameFr: "Amizmiz" },
    { name: "الحي الصناعي", nameFr: "Sidi Ghanem" },
    { name: "المنارة", nameFr: "Ménara" },
  ],
  fes: [
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "ظهر المهراز", nameFr: "Dhar El Mahraz" },
    { name: "سايس", nameFr: "Saiss" },
    { name: "أكدال", nameFr: "Agdal" },
    { name: "النرجس", nameFr: "Narjiss" },
    { name: "حي الحسني", nameFr: "Hay Hassani" },
    { name: "المرينيين", nameFr: "Mérinides" },
    { name: "الزهور", nameFr: "Zouhour" },
    { name: "الحي الصناعي", nameFr: "Sidi Brahim" },
    { name: "بنسودة", nameFr: "Bensouda" },
    { name: "عين النقبي", nameFr: "Ain Nokbi" },
    { name: "المرابطين", nameFr: "El Marabetine" },
    { name: "سهب الورد", nameFr: "Sahb El Ward" },
    { name: "الحي العلوي", nameFr: "Hay Alawi" },
  ],
  meknes: [
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "حمرية", nameFr: "Hamria" },
    { name: "مرجان 1", nameFr: "Marjane 1" },
    { name: "مرجان 2", nameFr: "Marjane 2" },
    { name: "الحي الإداري", nameFr: "Quartier Administratif" },
    { name: "تولال", nameFr: "Toulal" },
    { name: "البساتين", nameFr: "Bassatine" },
    { name: "بلقاسم", nameFr: "Belkacem" },
  ],
  tanger: [
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "مالاباطا", nameFr: "Malabata" },
    { name: "المرشان", nameFr: "Marchan" },
    { name: "بني مكادة", nameFr: "Beni Makada" },
    { name: "المنار", nameFr: "Mghogha" },
    { name: "الشرف", nameFr: "Charf" },
    { name: "بورو", nameFr: "Bouregreg" },
    { name: "مسنانة", nameFr: "Mesnana" },
    { name: "بني مكادة العليا", nameFr: "Beni Makada Sup" },
    { name: "الرمل", nameFr: "Rmal" },
    { name: "العوامة", nameFr: "Aouama" },
    { name: "الحدائق", nameFr: "Hdadiyine" },
    { name: "الزيتون", nameFr: "Ziaten" },
    { name: "طنجة البالية", nameFr: "Tanger Balia" },
    { name: "المرسى", nameFr: "Marina" },
    { name: "السواني", nameFr: "Souani" },
  ],
  tetouan: [
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "كوبرني", nameFr: "Cohen" },
    { name: "السانية", nameFr: "Sania" },
    { name: "توطان", nameFr: "Toutane" },
  ],
  oujda: [
    { name: "المدينة القديمة", nameFr: "Médina" },
    { name: "حي القدس", nameFr: "Hay Al Qods" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "الأندلس", nameFr: "Al Andalous" },
    { name: "حي الفتح", nameFr: "Hay El Fath" },
    { name: "حي النهضة", nameFr: "Hay Nahda" },
  ],
  nador: [
    { name: "الحي الجديد", nameFr: "Hay Jadid" },
    { name: "المطار", nameFr: "Al Matar" },
    { name: "حي الزيتون", nameFr: "Hay Zitoune" },
    { name: "المركب", nameFr: "Al Markaz" },
  ],
  agadir: [
    { name: "الحي المحمدي", nameFr: "Hay Mohammadi" },
    { name: "طلبرجت", nameFr: "Talborjt" },
    { name: "الهدى", nameFr: "Al Houda" },
    { name: "فونتي", nameFr: "Founty" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "الداخلة", nameFr: "Dakhla" },
    { name: "أنزا", nameFr: "Anza" },
    { name: "بن سركاو", nameFr: "Bensergao" },
    { name: "تيقي", nameFr: "Tikiouine" },
    { name: "حي الوفاق", nameFr: "Hay Wifaq" },
    { name: "المرسى", nameFr: "Marina" },
  ],
  "beni-mellal": [
    { name: "الحي الإداري", nameFr: "Quartier Administratif" },
    { name: "حي الأمل", nameFr: "Hay Amal" },
    { name: "حي السلام", nameFr: "Hay Salam" },
    { name: "الحي الحسني", nameFr: "Hay Hassani" },
  ],
};

// ═══════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════

async function main() {
  console.log(`🌍 Seeding ${MOROCCAN_CITIES.length} Moroccan cities...\n`);

  let citiesCreated = 0;
  let citiesUpdated = 0;
  let districtsCreated = 0;
  let districtsUpdated = 0;

  for (let i = 0; i < MOROCCAN_CITIES.length; i++) {
    const c = MOROCCAN_CITIES[i];

    // ═══ لون ثابت — hash على slug (لا على الاسم) ═══
    const cityHue = getColorHue(c.slug);
    const cityHex = getColorHex(c.slug);

    const existing = await prisma.city.findUnique({
      where: { slug: c.slug },
      select: { id: true },
    });

    let cityId: number;

    if (existing) {
      await prisma.city.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          nameFr: c.nameFr || null,
          region: c.region || null,
          order: i,
          colorHue: cityHue,
          colorHex: cityHex,
        },
      });
      cityId = existing.id;
      citiesUpdated++;
    } else {
      const created = await prisma.city.create({
        data: {
          name: c.name,
          nameFr: c.nameFr || null,
          slug: c.slug,
          region: c.region || null,
          order: i,
          colorHue: cityHue,
          colorHex: cityHex,
        },
      });
      cityId = created.id;
      citiesCreated++;
    }

    // ═══ Districts (إن وُجدت) ═══
    const districts = DISTRICTS_BY_SLUG[c.slug];
    if (districts && districts.length > 0) {
      for (let j = 0; j < districts.length; j++) {
        const d = districts[j];

        // ═══ لون الحي: hash على "name" (الأحياء بدون slug) ═══
        const dHue = getColorHue(d.name);
        const dHex = getColorHex(d.name);

        const existingDistrict = await prisma.district.findUnique({
          where: { cityId_name: { cityId, name: d.name } },
          select: { id: true },
        });

        if (existingDistrict) {
          await prisma.district.update({
            where: { id: existingDistrict.id },
            data: {
              nameFr: d.nameFr || null,
              type: (d.type as any) || "NEIGHBORHOOD",
              order: j,
              colorHue: dHue,
              colorHex: dHex,
            },
          });
          districtsUpdated++;
        } else {
          await prisma.district.create({
            data: {
              cityId,
              name: d.name,
              nameFr: d.nameFr || null,
              type: (d.type as any) || "NEIGHBORHOOD",
              order: j,
              colorHue: dHue,
              colorHex: dHex,
            },
          });
          districtsCreated++;
        }
      }
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  Total cities in source: ${MOROCCAN_CITIES.length}`);
  console.log(`  Cities created: ${citiesCreated}`);
  console.log(`  Cities updated: ${citiesUpdated}`);
  console.log(`  Districts created: ${districtsCreated}`);
  console.log(`  Districts updated: ${districtsUpdated}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });