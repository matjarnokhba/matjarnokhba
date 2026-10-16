// ═══════════════════════════════════════════
// القائمة الرسمية للمدن المغربية (112 مدينة)
// مقسمة حسب الجهات الـ12
// ═══════════════════════════════════════════

export type MoroccanCity = {
  name: string;
  nameFr: string;
  slug: string;
  region: string;
};

export const MOROCCAN_CITIES: MoroccanCity[] = [
  // ═══ 1. طنجة - تطوان - الحسيمة ═══
  { name: "طنجة", nameFr: "Tanger", slug: "tanger", region: "طنجة - تطوان - الحسيمة" },
  { name: "تطوان", nameFr: "Tétouan", slug: "tetouan", region: "طنجة - تطوان - الحسيمة" },
  { name: "العرائش", nameFr: "Larache", slug: "larache", region: "طنجة - تطوان - الحسيمة" },
  { name: "القصر الكبير", nameFr: "Ksar El Kebir", slug: "ksar-el-kebir", region: "طنجة - تطوان - الحسيمة" },
  { name: "أصيلة", nameFr: "Asilah", slug: "asilah", region: "طنجة - تطوان - الحسيمة" },
  { name: "الفنيدق", nameFr: "Fnideq", slug: "fnideq", region: "طنجة - تطوان - الحسيمة" },
  { name: "مارتيل", nameFr: "Martil", slug: "martil", region: "طنجة - تطوان - الحسيمة" },
  { name: "المضيق", nameFr: "M'diq", slug: "mdiq", region: "طنجة - تطوان - الحسيمة" },
  { name: "شفشاون", nameFr: "Chefchaouen", slug: "chefchaouen", region: "طنجة - تطوان - الحسيمة" },
  { name: "وزان", nameFr: "Ouezzane", slug: "ouezzane", region: "طنجة - تطوان - الحسيمة" },
  { name: "الحسيمة", nameFr: "Al Hoceima", slug: "al-hoceima", region: "طنجة - تطوان - الحسيمة" },
  { name: "إمزورن", nameFr: "Imzouren", slug: "imzouren", region: "طنجة - تطوان - الحسيمة" },
  { name: "بني بوعياش", nameFr: "Bni Bouayach", slug: "bni-bouayach", region: "طنجة - تطوان - الحسيمة" },
  { name: "تارجيست", nameFr: "Targuist", slug: "targuist", region: "طنجة - تطوان - الحسيمة" },
  { name: "وادي لو", nameFr: "Oued Laou", slug: "oued-laou", region: "طنجة - تطوان - الحسيمة" },
  { name: "أجدير", nameFr: "Ajdir", slug: "ajdir", region: "طنجة - تطوان - الحسيمة" },

  // ═══ 2. الشرق ═══
  { name: "وجدة", nameFr: "Oujda", slug: "oujda", region: "الشرق" },
  { name: "الناظور", nameFr: "Nador", slug: "nador", region: "الشرق" },
  { name: "بركان", nameFr: "Berkane", slug: "berkane", region: "الشرق" },
  { name: "تاوريرت", nameFr: "Taourirt", slug: "taourirt", region: "الشرق" },
  { name: "جرادة", nameFr: "Jerada", slug: "jerada", region: "الشرق" },
  { name: "جرسيف", nameFr: "Guercif", slug: "guercif", region: "الشرق" },
  { name: "فكيك", nameFr: "Figuig", slug: "figuig", region: "الشرق" },
  { name: "بوعرفة", nameFr: "Bouarfa", slug: "bouarfa", region: "الشرق" },
  { name: "العروي", nameFr: "Al Aaroui", slug: "al-aaroui", region: "الشرق" },
  { name: "بني أنصار", nameFr: "Beni Ansar", slug: "beni-ansar", region: "الشرق" },
  { name: "أحفير", nameFr: "Ahfir", slug: "ahfir", region: "الشرق" },
  { name: "السعيدية", nameFr: "Saïdia", slug: "saidia", region: "الشرق" },
  { name: "العيون سيدي ملوك", nameFr: "El Aioun Sidi Mellouk", slug: "el-aioun-sidi-mellouk", region: "الشرق" },
  { name: "دبدو", nameFr: "Debdou", slug: "debdou", region: "الشرق" },
  { name: "زايو", nameFr: "Zaio", slug: "zaio", region: "الشرق" },
  { name: "رأس الماء", nameFr: "Ras El Ma", slug: "ras-el-ma", region: "الشرق" },
  { name: "الدريوش", nameFr: "Driouch", slug: "driouch", region: "الشرق" },
  { name: "ميضار", nameFr: "Midar", slug: "midar", region: "الشرق" },

  // ═══ 3. فاس - مكناس ═══
  { name: "فاس", nameFr: "Fès", slug: "fes", region: "فاس - مكناس" },
  { name: "مكناس", nameFr: "Meknès", slug: "meknes", region: "فاس - مكناس" },
  { name: "تازة", nameFr: "Taza", slug: "taza", region: "فاس - مكناس" },
  { name: "صفرو", nameFr: "Sefrou", slug: "sefrou", region: "فاس - مكناس" },
  { name: "إفران", nameFr: "Ifrane", slug: "ifrane", region: "فاس - مكناس" },
  { name: "الحاج قدور", nameFr: "Haj Kaddour", slug: "haj-kaddour", region: "فاس - مكناس" },
  { name: "مولاي إدريس زرهون", nameFr: "Moulay Idriss Zerhoun", slug: "moulay-idriss-zerhoun", region: "فاس - مكناس" },
  { name: "بولمان", nameFr: "Boulemane", slug: "boulemane", region: "فاس - مكناس" },
  { name: "ميسور", nameFr: "Missour", slug: "missour", region: "فاس - مكناس" },
  { name: "أوطاط الحاج", nameFr: "Outat El Haj", slug: "outat-el-haj", region: "فاس - مكناس" },
  { name: "أزرو", nameFr: "Azrou", slug: "azrou", region: "فاس - مكناس" },
  { name: "عين تاوجطات", nameFr: "Ain Taoujdate", slug: "ain-taoujdate", region: "فاس - مكناس" },
  { name: "تاهلة", nameFr: "Tahla", slug: "tahla", region: "فاس - مكناس" },
  { name: "غفساي", nameFr: "Ghafsai", slug: "ghafsai", region: "فاس - مكناس" },
  { name: "تاونات", nameFr: "Taounate", slug: "taounate", region: "فاس - مكناس" },
  { name: "البهاليل", nameFr: "Bhalil", slug: "bhalil", region: "فاس - مكناس" },
  { name: "إيموزار كندر", nameFr: "Imouzzer Kandar", slug: "imouzzer-kandar", region: "فاس - مكناس" },
  { name: "إيموزار مرموشة", nameFr: "Imouzzer Marmoucha", slug: "imouzzer-marmoucha", region: "فاس - مكناس" },

  // ═══ 4. الرباط - سلا - القنيطرة ═══
  { name: "الرباط", nameFr: "Rabat", slug: "rabat", region: "الرباط - سلا - القنيطرة" },
  { name: "سلا", nameFr: "Salé", slug: "sale", region: "الرباط - سلا - القنيطرة" },
  { name: "القنيطرة", nameFr: "Kénitra", slug: "kenitra", region: "الرباط - سلا - القنيطرة" },
  { name: "تمارة", nameFr: "Témara", slug: "temara", region: "الرباط - سلا - القنيطرة" },
  { name: "الصخيرات", nameFr: "Skhirat", slug: "skhirat", region: "الرباط - سلا - القنيطرة" },
  { name: "الخميسات", nameFr: "Khémisset", slug: "khemisset", region: "الرباط - سلا - القنيطرة" },
  { name: "تيفلت", nameFr: "Tiflet", slug: "tiflet", region: "الرباط - سلا - القنيطرة" },
  { name: "سيدي قاسم", nameFr: "Sidi Kacem", slug: "sidi-kacem", region: "الرباط - سلا - القنيطرة" },
  { name: "سيدي سليمان", nameFr: "Sidi Slimane", slug: "sidi-slimane", region: "الرباط - سلا - القنيطرة" },
  { name: "الهرهورة", nameFr: "Harhoura", slug: "harhoura", region: "الرباط - سلا - القنيطرة" },
  { name: "سيدي يحيى الغرب", nameFr: "Sidi Yahya El Gharb", slug: "sidi-yahya-el-gharb", region: "الرباط - سلا - القنيطرة" },
  { name: "سوق الأربعاء الغرب", nameFr: "Souk El Arbaa", slug: "souk-el-arbaa", region: "الرباط - سلا - القنيطرة" },
  { name: "بوقنادل", nameFr: "Bouknadel", slug: "bouknadel", region: "الرباط - سلا - القنيطرة" },
  { name: "مرشوش", nameFr: "Mers El Kheir", slug: "mers-el-kheir", region: "الرباط - سلا - القنيطرة" },

  // ═══ 5. بني ملال - خنيفرة ═══
  { name: "بني ملال", nameFr: "Béni Mellal", slug: "beni-mellal", region: "بني ملال - خنيفرة" },
  { name: "خريبكة", nameFr: "Khouribga", slug: "khouribga", region: "بني ملال - خنيفرة" },
  { name: "الفقيه بن صالح", nameFr: "Fquih Ben Salah", slug: "fquih-ben-salah", region: "بني ملال - خنيفرة" },
  { name: "أزيلال", nameFr: "Azilal", slug: "azilal", region: "بني ملال - خنيفرة" },
  { name: "خنيفرة", nameFr: "Khénifra", slug: "khenifra", region: "بني ملال - خنيفرة" },
  { name: "وادي زم", nameFr: "Oued Zem", slug: "oued-zem", region: "بني ملال - خنيفرة" },
  { name: "قلعة السراغنة", nameFr: "Kelaa des Sraghna", slug: "kelaa-des-sraghna", region: "بني ملال - خنيفرة" },
  { name: "قصبة تادلة", nameFr: "Kasba Tadla", slug: "kasba-tadla", region: "بني ملال - خنيفرة" },
  { name: "دمنات", nameFr: "Demnate", slug: "demnate", region: "بني ملال - خنيفرة" },
  { name: "مريرت", nameFr: "Mrirt", slug: "mrirt", region: "بني ملال - خنيفرة" },
  { name: "زاوية الشيخ", nameFr: "Zaouiat Cheikh", slug: "zaouiat-cheikh", region: "بني ملال - خنيفرة" },
  { name: "بوموسى", nameFr: "Bou Moussa", slug: "bou-moussa", region: "بني ملال - خنيفرة" },
  { name: "أبي الجعد", nameFr: "Bejaad", slug: "bejaad", region: "بني ملال - خنيفرة" },

  // ═══ 6. الدار البيضاء - سطات ═══
  { name: "الدار البيضاء", nameFr: "Casablanca", slug: "casablanca", region: "الدار البيضاء - سطات" },
  { name: "المحمدية", nameFr: "Mohammedia", slug: "mohammedia", region: "الدار البيضاء - سطات" },
  { name: "الجديدة", nameFr: "El Jadida", slug: "el-jadida", region: "الدار البيضاء - سطات" },
  { name: "سطات", nameFr: "Settat", slug: "settat", region: "الدار البيضاء - سطات" },
  { name: "برشيد", nameFr: "Berrechid", slug: "berrechid", region: "الدار البيضاء - سطات" },
  { name: "بنسليمان", nameFr: "Benslimane", slug: "benslimane", region: "الدار البيضاء - سطات" },
  { name: "دار بوعزة", nameFr: "Dar Bouazza", slug: "dar-bouazza", region: "الدار البيضاء - سطات" },
  { name: "الوسمة", nameFr: "Ouled Abbou", slug: "ouled-abbou", region: "الدار البيضاء - سطات" },
  { name: "أزمور", nameFr: "Azemmour", slug: "azemmour", region: "الدار البيضاء - سطات" },
  { name: "مديونة", nameFr: "Médiouna", slug: "mediouna", region: "الدار البيضاء - سطات" },
  { name: "النواصر", nameFr: "Nouaceur", slug: "nouaceur", region: "الدار البيضاء - سطات" },
  { name: "البئر الجديد", nameFr: "Bir Jdid", slug: "bir-jdid", region: "الدار البيضاء - سطات" },
  { name: "الكارة", nameFr: "Lakhsas", slug: "lakhsas", region: "الدار البيضاء - سطات" },
  { name: "السوالم", nameFr: "Soualem", slug: "soualem", region: "الدار البيضاء - سطات" },
  { name: "الهراويين", nameFr: "Lahraouyine", slug: "lahraouyine", region: "الدار البيضاء - سطات" },

  // ═══ 7. مراكش - آسفي ═══
  { name: "مراكش", nameFr: "Marrakech", slug: "marrakech", region: "مراكش - آسفي" },
  { name: "آسفي", nameFr: "Safi", slug: "safi", region: "مراكش - آسفي" },
  { name: "الصويرة", nameFr: "Essaouira", slug: "essaouira", region: "مراكش - آسفي" },
  { name: "قلعة السراغنة", nameFr: "Kelaa des Sraghna", slug: "kelaa-des-sraghna-2", region: "مراكش - آسفي" },
  { name: "اليوسفية", nameFr: "Youssoufia", slug: "youssoufia", region: "مراكش - آسفي" },
  { name: "ابن جرير", nameFr: "Ben Guerir", slug: "ben-guerir", region: "مراكش - آسفي" },
  { name: "شيشاوة", nameFr: "Chichaoua", slug: "chichaoua", region: "مراكش - آسفي" },
  { name: "تامنصورت", nameFr: "Tamansourt", slug: "tamansourt", region: "مراكش - آسفي" },
  { name: "العطاوية", nameFr: "Lattaouia", slug: "lattaouia", region: "مراكش - آسفي" },
  { name: "سيدي رحال", nameFr: "Sidi Rahal", slug: "sidi-rahal", region: "مراكش - آسفي" },
  { name: "امنتانوت", nameFr: "Imintanoute", slug: "imintanoute", region: "مراكش - آسفي" },
  { name: "تازارين", nameFr: "Tazart", slug: "tazart", region: "مراكش - آسفي" },

  // ═══ 8. درعة - تافيلالت ═══
  { name: "الرشيدية", nameFr: "Errachidia", slug: "errachidia", region: "درعة - تافيلالت" },
  { name: "ورزازات", nameFr: "Ouarzazate", slug: "ouarzazate", region: "درعة - تافيلالت" },
  { name: "تنغير", nameFr: "Tinghir", slug: "tinghir", region: "درعة - تافيلالت" },
  { name: "ميدلت", nameFr: "Midelt", slug: "midelt", region: "درعة - تافيلالت" },
  { name: "زاكورة", nameFr: "Zagora", slug: "zagora", region: "درعة - تافيلالت" },
  { name: "أرفود", nameFr: "Arfoud", slug: "arfoud", region: "درعة - تافيلالت" },
  { name: "الريصاني", nameFr: "Rissani", slug: "rissani", region: "درعة - تافيلالت" },
  { name: "قلعة مكونة", nameFr: "Kelaa M'Gouna", slug: "kelaa-mgouna", region: "درعة - تافيلالت" },
  { name: "بومالن دادس", nameFr: "Boumalne Dades", slug: "boumalne-dades", region: "درعة - تافيلالت" },
  { name: "نكوب", nameFr: "N'kob", slug: "nkob", region: "درعة - تافيلالت" },

  // ═══ 9. سوس - ماسة ═══
  { name: "أكادير", nameFr: "Agadir", slug: "agadir", region: "سوس - ماسة" },
  { name: "إنزكان", nameFr: "Inezgane", slug: "inezgane", region: "سوس - ماسة" },
  { name: "أيت ملول", nameFr: "Ait Melloul", slug: "ait-melloul", region: "سوس - ماسة" },
  { name: "تارودانت", nameFr: "Taroudant", slug: "taroudant", region: "سوس - ماسة" },
  { name: "تيزنيت", nameFr: "Tiznit", slug: "tiznit", region: "سوس - ماسة" },
  { name: "طاطا", nameFr: "Tata", slug: "tata", region: "سوس - ماسة" },
  { name: "أولاد تايمة", nameFr: "Ouled Teima", slug: "ouled-teima", region: "سوس - ماسة" },
  { name: "الدشيرة الجهادية", nameFr: "Dcheira El Jihadia", slug: "dcheira-el-jihadia", region: "سوس - ماسة" },
  { name: "بيوكرى", nameFr: "Biougra", slug: "biougra", region: "سوس - ماسة" },
  { name: "أورير", nameFr: "Aourir", slug: "aourir", region: "سوس - ماسة" },
  { name: "الدراركة", nameFr: "Drarga", slug: "drarga", region: "سوس - ماسة" },
  { name: "الڭليعة", nameFr: "Guelmim", slug: "guelmim-2", region: "سوس - ماسة" },
  { name: "تيوغزة", nameFr: "Tioughza", slug: "tioughza", region: "سوس - ماسة" },

  // ═══ 10. كلميم - واد نون ═══
  { name: "كلميم", nameFr: "Guelmim", slug: "guelmim", region: "كلميم - واد نون" },
  { name: "طانطان", nameFr: "Tan-Tan", slug: "tan-tan", region: "كلميم - واد نون" },
  { name: "أسا", nameFr: "Assa", slug: "assa", region: "كلميم - واد نون" },
  { name: "الزاك", nameFr: "Zag", slug: "zag", region: "كلميم - واد نون" },
  { name: "سيدي إفني", nameFr: "Sidi Ifni", slug: "sidi-ifni", region: "كلميم - واد نون" },
  { name: "بويزكارن", nameFr: "Bouizakarne", slug: "bouizakarne", region: "كلميم - واد نون" },

  // ═══ 11. العيون - الساقية الحمراء ═══
  { name: "العيون", nameFr: "Laâyoune", slug: "laayoune", region: "العيون - الساقية الحمراء" },
  { name: "السمارة", nameFr: "Smara", slug: "smara", region: "العيون - الساقية الحمراء" },
  { name: "بوجدور", nameFr: "Boujdour", slug: "boujdour", region: "العيون - الساقية الحمراء" },
  { name: "المرسى", nameFr: "El Marsa", slug: "el-marsa", region: "العيون - الساقية الحمراء" },
  { name: "طرفاية", nameFr: "Tarfaya", slug: "tarfaya", region: "العيون - الساقية الحمراء" },

  // ═══ 12. الداخلة - وادي الذهب ═══
  { name: "الداخلة", nameFr: "Dakhla", slug: "dakhla", region: "الداخلة - وادي الذهب" },
  { name: "أوسرد", nameFr: "Aousserd", slug: "aousserd", region: "الداخلة - وادي الذهب" },
  { name: "الكويرة", nameFr: "Lagouira", slug: "lagouira", region: "الداخلة - وادي الذهب" },
];

// ═══ Normalize text for fuzzy matching ═══
function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئء]/g, "ء")
    .replace(/[ةه]/g, "ه")
    .replace(/[\s\-_.']+/g, " ")
    .replace(/ou/g, "u")
    .replace(/ph/g, "f");
}

// ═══ Levenshtein distance (bounded) ═══
function levenshtein(a: string, b: string, maxDist = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ═══ Fuzzy search cities ═══
export function searchMoroccanCities(
  query: string,
  limit = 20
): MoroccanCity[] {
  const q = normalize(query);
  if (q.length < 2) return MOROCCAN_CITIES.slice(0, limit);

  const scored = MOROCCAN_CITIES.map((city) => {
    const nAr = normalize(city.name);
    const nFr = normalize(city.nameFr);
    const nSlug = normalize(city.slug);

    // ═══ Prefix match (score 0) ═══
    if (nAr.startsWith(q) || nFr.startsWith(q)) return { city, score: 0 };

    // ═══ Contains (score 1) ═══
    if (nAr.includes(q) || nFr.includes(q) || nSlug.includes(q)) {
      return { city, score: 1 };
    }

    // ═══ Levenshtein (score 2-4) ═══
    const dist = Math.min(
      levenshtein(q, nAr.slice(0, q.length + 2)),
      levenshtein(q, nFr.slice(0, q.length + 2))
    );

    if (dist <= 2) return { city, score: 2 + dist };

    return { city, score: 100 };
  });

  return scored
    .filter((s) => s.score < 100)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.city);
}