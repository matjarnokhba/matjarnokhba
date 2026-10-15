import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئء]/g, "ء")
    .replace(/[ةه]/g, "ه")
    .replace(/[\s\-_.]+/g, " ");
}

function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function getColorHue(name: string): number {
  const normalized = normalizeName(name);
  if (!normalized) return 0;
  return fnv1aHash(normalized) % 360;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getColorHex(name: string): string {
  return hslToHex(getColorHue(name), 65, 45);
}

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ═══════════════════════════════════════════
// تعريف المدن + أحياء المدن الكبرى
// ═══════════════════════════════════════════

type DistrictInput = {
  name: string;
  nameFr?: string;
  type?: "NEIGHBORHOOD" | "RURAL" | "DOUAR" | "VILLAGE";
};

type CityInput = {
  name: string;
  nameFr?: string;
  slug: string;
  region?: string;
  postalCode?: string;
  districts?: DistrictInput[];
};

const CITIES: CityInput[] = [
  // ═══════════════════════════════════════════
  // الدار البيضاء - سطات
  // ═══════════════════════════════════════════
  {
    name: "الدار البيضاء",
    nameFr: "Casablanca",
    slug: "casablanca",
    region: "الدار البيضاء - سطات",
    postalCode: "20000",
    districts: [
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
      { name: "النخيل", nameFr: "Anfa Place / Ain Diab" },
      { name: "حي السلام", nameFr: "Hay Salam" },
      { name: "الحي الإداري", nameFr: "Quartier Administratif" },
      { name: "ليزونيون", nameFr: "Les Orangers" },
      { name: "الراشيدية البيضاء", nameFr: "Errachidia" },
      { name: "التشارك", nameFr: "Tacharouk" },
      { name: "الفرح", nameFr: "Al Farah" },
      { name: "الصخور السوداء", nameFr: "Roches Noires" },
      { name: "الأمل", nameFr: "Al Amal" },
      { name: "حي رحمة", nameFr: "Hay Rahma" },
      { name: "الحي الصناعي", nameFr: "Zone Industrielle" },
      { name: "الحي الجديد", nameFr: "Hay Jadid" },
    ],
  },
  {
    name: "المحمدية",
    nameFr: "Mohammedia",
    slug: "mohammedia",
    region: "الدار البيضاء - سطات",
    postalCode: "28810",
    districts: [
      { name: "الحسانية", nameFr: "Al Hassania" },
      { name: "العلويين", nameFr: "Al Alawiyine" },
      { name: "حي السلام", nameFr: "Hay Salam" },
      { name: "المركز", nameFr: "Centre" },
      { name: "الحي الحسني", nameFr: "Hay Hassani" },
    ],
  },
  {
    name: "سطات",
    nameFr: "Settat",
    slug: "settat",
    region: "الدار البيضاء - سطات",
    postalCode: "26000",
  },
  {
    name: "برشيد",
    nameFr: "Berrechid",
    slug: "berrechid",
    region: "الدار البيضاء - سطات",
    postalCode: "26100",
  },
  {
    name: "الجديدة",
    nameFr: "El Jadida",
    slug: "el-jadida",
    region: "الدار البيضاء - سطات",
    postalCode: "24000",
  },
  {
    name: "أزمور",
    nameFr: "Azemmour",
    slug: "azemmour",
    region: "الدار البيضاء - سطات",
  },
  {
    name: "بنجرير",
    nameFr: "Benguerir",
    slug: "benguerir",
    region: "مراكش - آسفي",
  },
  {
    name: "خريبكة",
    nameFr: "Khouribga",
    slug: "khouribga",
    region: "بني ملال - خنيفرة",
    postalCode: "25000",
  },
  {
    name: "الفقيه بن صالح",
    nameFr: "Fquih Ben Salah",
    slug: "fquih-ben-salah",
    region: "بني ملال - خنيفرة",
  },

  // ═══════════════════════════════════════════
  // الرباط - سلا - القنيطرة
  // ═══════════════════════════════════════════
  {
    name: "الرباط",
    nameFr: "Rabat",
    slug: "rabat",
    region: "الرباط - سلا - القنيطرة",
    postalCode: "10000",
    districts: [
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
  },
  {
    name: "سلا",
    nameFr: "Salé",
    slug: "sale",
    region: "الرباط - سلا - القنيطرة",
    postalCode: "11000",
    districts: [
      { name: "بتابري", nameFr: "Bettana" },
      { name: "تابريكت", nameFr: "Tabriquet" },
      { name: "السلام", nameFr: "Sala Al Jadida" },
      { name: "حي الرحمة", nameFr: "Hay Rahma" },
      { name: "العرجات", nameFr: "Arajar" },
      { name: "الحي الحسني", nameFr: "Hay Hassani" },
      { name: "المرسى", nameFr: "Marina" },
      { name: "شالة", nameFr: "Chellah" },
    ],
  },
  {
    name: "تمارة",
    nameFr: "Témara",
    slug: "temara",
    region: "الرباط - سلا - القنيطرة",
  },
  {
    name: "الصخيرات",
    nameFr: "Skhirat",
    slug: "skhirat",
    region: "الرباط - سلا - القنيطرة",
  },
  {
    name: "القنيطرة",
    nameFr: "Kénitra",
    slug: "kenitra",
    region: "الرباط - سلا - القنيطرة",
    postalCode: "14000",
    districts: [
      { name: "المغرب العربي", nameFr: "Maghreb Arabi" },
      { name: "ميموزا", nameFr: "Mimosa" },
      { name: "حي السلام", nameFr: "Hay Salam" },
      { name: "الحي الإداري", nameFr: "Quartier Administratif" },
      { name: "وادي سبو", nameFr: "Oued Sebou" },
    ],
  },
  {
    name: "سيدي قاسم",
    nameFr: "Sidi Kacem",
    slug: "sidi-kacem",
    region: "الرباط - سلا - القنيطرة",
  },
  {
    name: "سيدي سليمان",
    nameFr: "Sidi Slimane",
    slug: "sidi-slimane",
    region: "الرباط - سلا - القنيطرة",
  },
  {
    name: "الخميسات",
    nameFr: "Khémisset",
    slug: "khemisset",
    region: "الرباط - سلا - القنيطرة",
  },

  // ═══════════════════════════════════════════
  // مراكش - آسفي
  // ═══════════════════════════════════════════
  {
    name: "مراكش",
    nameFr: "Marrakech",
    slug: "marrakech",
    region: "مراكش - آسفي",
    postalCode: "40000",
    districts: [
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
      { name: "حي الحسني", nameFr: "Hay Mohammadi" },
      { name: "المنارة", nameFr: "Ménara" },
    ],
  },
  {
    name: "آسفي",
    nameFr: "Safi",
    slug: "safi",
    region: "مراكش - آسفي",
    postalCode: "46000",
  },
  {
    name: "الصويرة",
    nameFr: "Essaouira",
    slug: "essaouira",
    region: "مراكش - آسفي",
  },
  {
    name: "قلعة السراغنة",
    nameFr: "Kelaa des Sraghna",
    slug: "kelaa-des-sraghna",
    region: "مراكش - آسفي",
  },
  {
    name: "اليوسفية",
    nameFr: "Youssoufia",
    slug: "youssoufia",
    region: "مراكش - آسفي",
  },

  // ═══════════════════════════════════════════
  // فاس - مكناس
  // ═══════════════════════════════════════════
  {
    name: "فاس",
    nameFr: "Fès",
    slug: "fes",
    region: "فاس - مكناس",
    postalCode: "30000",
    districts: [
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
  },
  {
    name: "مكناس",
    nameFr: "Meknès",
    slug: "meknes",
    region: "فاس - مكناس",
    postalCode: "50000",
    districts: [
      { name: "المدينة القديمة", nameFr: "Médina" },
      { name: "حمرية", nameFr: "Hamria" },
      { name: "مرجان 1", nameFr: "Marjane 1" },
      { name: "مرجان 2", nameFr: "Marjane 2" },
      { name: "الحي الإداري", nameFr: "Quartier Administratif" },
      { name: "تولال", nameFr: "Toulal" },
      { name: "البساتين", nameFr: "Bassatine" },
      { name: "بلقاسم", nameFr: "Belkacem" },
    ],
  },
  {
    name: "إفران",
    nameFr: "Ifrane",
    slug: "ifrane",
    region: "فاس - مكناس",
  },
  {
    name: "الحاجب",
    nameFr: "El Hajeb",
    slug: "el-hajeb",
    region: "فاس - مكناس",
  },
  {
    name: "صفرو",
    nameFr: "Sefrou",
    slug: "sefrou",
    region: "فاس - مكناس",
  },
  {
    name: "بولمان",
    nameFr: "Boulemane",
    slug: "boulemane",
    region: "فاس - مكناس",
  },
  {
    name: "تاونات",
    nameFr: "Taounate",
    slug: "taounate",
    region: "فاس - مكناس",
  },
  {
    name: "تازة",
    nameFr: "Taza",
    slug: "taza",
    region: "فاس - مكناس",
    postalCode: "35000",
  },

  // ═══════════════════════════════════════════
  // طنجة - تطوان - الحسيمة
  // ═══════════════════════════════════════════
  {
    name: "طنجة",
    nameFr: "Tanger",
    slug: "tanger",
    region: "طنجة - تطوان - الحسيمة",
    postalCode: "90000",
    districts: [
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
  },
  {
    name: "تطوان",
    nameFr: "Tétouan",
    slug: "tetouan",
    region: "طنجة - تطوان - الحسيمة",
    postalCode: "93000",
    districts: [
      { name: "المدينة القديمة", nameFr: "Médina" },
      { name: "حي السلام", nameFr: "Hay Salam" },
      { name: "كوبرني", nameFr: "Cohen" },
      { name: "السانية", nameFr: "Sania" },
      { name: "توطان", nameFr: "Toutane" },
    ],
  },
  {
    name: "المضيق",
    nameFr: "M'diq",
    slug: "mdiq",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "الفنيدق",
    nameFr: "Fnideq",
    slug: "fnideq",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "مرتيل",
    nameFr: "Martil",
    slug: "martil",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "العرائش",
    nameFr: "Larache",
    slug: "larache",
    region: "طنجة - تطوان - الحسيمة",
    postalCode: "92000",
  },
  {
    name: "القصر الكبير",
    nameFr: "Ksar El Kebir",
    slug: "ksar-el-kebir",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "أصيلة",
    nameFr: "Asilah",
    slug: "asilah",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "الحسيمة",
    nameFr: "Al Hoceima",
    slug: "al-hoceima",
    region: "طنجة - تطوان - الحسيمة",
    postalCode: "32000",
  },
  {
    name: "إمزورن",
    nameFr: "Imzouren",
    slug: "imzouren",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "شفشاون",
    nameFr: "Chefchaouen",
    slug: "chefchaouen",
    region: "طنجة - تطوان - الحسيمة",
  },
  {
    name: "وزان",
    nameFr: "Ouezzane",
    slug: "ouezzane",
    region: "طنجة - تطوان - الحسيمة",
  },

  // ═══════════════════════════════════════════
  // الشرق
  // ═══════════════════════════════════════════
  {
    name: "وجدة",
    nameFr: "Oujda",
    slug: "oujda",
    region: "الشرق",
    postalCode: "60000",
    districts: [
      { name: "المدينة القديمة", nameFr: "Médina" },
      { name: "حي القدس", nameFr: "Hay Al Qods" },
      { name: "حي السلام", nameFr: "Hay Salam" },
      { name: "الأندلس", nameFr: "Al Andalous" },
      { name: "حي الفتح", nameFr: "Hay El Fath" },
      { name: "حي النهضة", nameFr: "Hay Nahda" },
    ],
  },
  {
    name: "الناظور",
    nameFr: "Nador",
    slug: "nador",
    region: "الشرق",
    postalCode: "62000",
    districts: [
      { name: "الحي الجديد", nameFr: "Hay Jadid" },
      { name: "المطار", nameFr: "Al Matar" },
      { name: "حي الزيتون", nameFr: "Hay Zitoune" },
      { name: "المركب", nameFr: "Al Markaz" },
    ],
  },
  {
    name: "بركان",
    nameFr: "Berkane",
    slug: "berkane",
    region: "الشرق",
  },
  {
    name: "تاوريرت",
    nameFr: "Taourirt",
    slug: "taourirt",
    region: "الشرق",
  },
  {
    name: "جرسيف",
    nameFr: "Guercif",
    slug: "guercif",
    region: "الشرق",
  },
  {
    name: "فكيك",
    nameFr: "Figuig",
    slug: "figuig",
    region: "الشرق",
  },
  {
    name: "جرادة",
    nameFr: "Jerada",
    slug: "jerada",
    region: "الشرق",
  },

  // ═══════════════════════════════════════════
  // سوس - ماسة
  // ═══════════════════════════════════════════
  {
    name: "أكادير",
    nameFr: "Agadir",
    slug: "agadir",
    region: "سوس - ماسة",
    postalCode: "80000",
    districts: [
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
  },
  {
    name: "إنزكان",
    nameFr: "Inezgane",
    slug: "inezgane",
    region: "سوس - ماسة",
  },
  {
    name: "آيت ملول",
    nameFr: "Ait Melloul",
    slug: "ait-melloul",
    region: "سوس - ماسة",
  },
  {
    name: "تارودانت",
    nameFr: "Taroudant",
    slug: "taroudant",
    region: "سوس - ماسة",
  },
  {
    name: "تيزنيت",
    nameFr: "Tiznit",
    slug: "tiznit",
    region: "سوس - ماسة",
  },
  {
    name: "ورزازات",
    nameFr: "Ouarzazate",
    slug: "ouarzazate",
    region: "درعة - تافيلالت",
  },
  {
    name: "زاكورة",
    nameFr: "Zagora",
    slug: "zagora",
    region: "درعة - تافيلالت",
  },
  {
    name: "تنغير",
    nameFr: "Tinghir",
    slug: "tinghir",
    region: "درعة - تافيلالت",
  },
  {
    name: "الرشيدية",
    nameFr: "Errachidia",
    slug: "errachidia",
    region: "درعة - تافيلالت",
  },
  {
    name: "ميدلت",
    nameFr: "Midelt",
    slug: "midelt",
    region: "درعة - تافيلالت",
  },
  {
    name: "كلميم",
    nameFr: "Guelmim",
    slug: "guelmim",
    region: "كلميم - واد نون",
  },
  {
    name: "طانطان",
    nameFr: "Tan-Tan",
    slug: "tan-tan",
    region: "كلميم - واد نون",
  },
  {
    name: "سيدي إفني",
    nameFr: "Sidi Ifni",
    slug: "sidi-ifni",
    region: "كلميم - واد نون",
  },

  // ═══════════════════════════════════════════
  // بني ملال - خنيفرة
  // ═══════════════════════════════════════════
  {
    name: "بني ملال",
    nameFr: "Béni Mellal",
    slug: "beni-mellal",
    region: "بني ملال - خنيفرة",
    postalCode: "23000",
    districts: [
      { name: "الحي الإداري", nameFr: "Quartier Administratif" },
      { name: "حي الأمل", nameFr: "Hay Amal" },
      { name: "حي السلام", nameFr: "Hay Salam" },
      { name: "الحي الحسني", nameFr: "Hay Hassani" },
    ],
  },
  {
    name: "خنيفرة",
    nameFr: "Khénifra",
    slug: "khenifra",
    region: "بني ملال - خنيفرة",
  },
  {
    name: "الفقيه بن صالح",
    nameFr: "Fquih Ben Salah",
    slug: "fquih-ben-salah-2",
    region: "بني ملال - خنيفرة",
  },
  {
    name: "أزيلال",
    nameFr: "Azilal",
    slug: "azilal",
    region: "بني ملال - خنيفرة",
  },

  // ═══════════════════════════════════════════
  // الأقاليم الجنوبية
  // ═══════════════════════════════════════════
  {
    name: "العيون",
    nameFr: "Laâyoune",
    slug: "laayoune",
    region: "العيون - الساقية الحمراء",
    postalCode: "70000",
  },
  {
    name: "بوجدور",
    nameFr: "Boujdour",
    slug: "boujdour",
    region: "العيون - الساقية الحمراء",
  },
  {
    name: "السمارة",
    nameFr: "Smara",
    slug: "smara",
    region: "العيون - الساقية الحمراء",
  },
  {
    name: "الداخلة",
    nameFr: "Dakhla",
    slug: "dakhla",
    region: "الداخلة - وادي الذهب",
    postalCode: "73000",
  },
  {
    name: "أوسرد",
    nameFr: "Aousserd",
    slug: "aousserd",
    region: "الداخلة - وادي الذهب",
  },
];

// ═══════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════

async function main() {
  console.log("🌍 Seeding cities and districts...\n");

  let citiesCreated = 0;
  let citiesUpdated = 0;
  let districtsCreated = 0;
  let districtsUpdated = 0;

  for (let i = 0; i < CITIES.length; i++) {
    const c = CITIES[i];

    const existing = await prisma.city.findUnique({
      where: { slug: c.slug },
      select: { id: true },
    });

    let cityId: number;

    const cityHue = getColorHue(c.name);
    const cityHex = getColorHex(c.name);

    if (existing) {
      await prisma.city.update({
        where: { id: existing.id },
        data: {
          name: c.name,
          nameFr: c.nameFr || null,
          region: c.region || null,
          postalCode: c.postalCode || null,
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
          postalCode: c.postalCode || null,
          order: i,
          colorHue: cityHue,
          colorHex: cityHex,
        },
      });
      cityId = created.id;
      citiesCreated++;
    }

    // ═══ Districts ═══
    if (c.districts && c.districts.length > 0) {
      for (let j = 0; j < c.districts.length; j++) {
        const d = c.districts[j];

        const existingDistrict = await prisma.district.findUnique({
          where: {
            cityId_name: { cityId, name: d.name },
          },
          select: { id: true },
        });

        const dHue = getColorHue(d.name);
        const dHex = getColorHex(d.name);

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
  console.log(`  Cities created: ${citiesCreated}`);
  console.log(`  Cities updated: ${citiesUpdated}`);
  console.log(`  Districts created: ${districtsCreated}`);
  console.log(`  Districts updated: ${districtsUpdated}`);
  console.log(`  Total cities: ${CITIES.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });