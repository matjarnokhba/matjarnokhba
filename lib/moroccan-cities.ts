// ═══════════════════════════════════════════
// قائمة شاملة للمدن والبلديات المغربية
// ~250 مدينة + بلدية موزّعة على 12 جهة
// ═══════════════════════════════════════════

export type MoroccanCity = {
  name: string;
  nameFr: string;
  slug: string;
  region: string;
};

export const MOROCCAN_CITIES: MoroccanCity[] = [
  // ═══════════════════════════════════════════
  // 1. طنجة - تطوان - الحسيمة (22)
  // ═══════════════════════════════════════════
  { name: "طنجة", nameFr: "Tanger", slug: "tanger", region: "طنجة - تطوان - الحسيمة" },
  { name: "تطوان", nameFr: "Tétouan", slug: "tetouan", region: "طنجة - تطوان - الحسيمة" },
  { name: "الحسيمة", nameFr: "Al Hoceima", slug: "al-hoceima", region: "طنجة - تطوان - الحسيمة" },
  { name: "العرائش", nameFr: "Larache", slug: "larache", region: "طنجة - تطوان - الحسيمة" },
  { name: "القصر الكبير", nameFr: "Ksar El Kebir", slug: "ksar-el-kebir", region: "طنجة - تطوان - الحسيمة" },
  { name: "أصيلة", nameFr: "Asilah", slug: "asilah", region: "طنجة - تطوان - الحسيمة" },
  { name: "الفنيدق", nameFr: "Fnideq", slug: "fnideq", region: "طنجة - تطوان - الحسيمة" },
  { name: "مارتيل", nameFr: "Martil", slug: "martil", region: "طنجة - تطوان - الحسيمة" },
  { name: "المضيق", nameFr: "M'diq", slug: "mdiq", region: "طنجة - تطوان - الحسيمة" },
  { name: "شفشاون", nameFr: "Chefchaouen", slug: "chefchaouen", region: "طنجة - تطوان - الحسيمة" },
  { name: "وزان", nameFr: "Ouezzane", slug: "ouezzane", region: "طنجة - تطوان - الحسيمة" },
  { name: "إمزورن", nameFr: "Imzouren", slug: "imzouren", region: "طنجة - تطوان - الحسيمة" },
  { name: "بني بوعياش", nameFr: "Bni Bouayach", slug: "bni-bouayach", region: "طنجة - تطوان - الحسيمة" },
  { name: "تارجيست", nameFr: "Targuist", slug: "targuist", region: "طنجة - تطوان - الحسيمة" },
  { name: "أجدير", nameFr: "Ajdir", slug: "ajdir", region: "طنجة - تطوان - الحسيمة" },
  { name: "وادي لو", nameFr: "Oued Laou", slug: "oued-laou", region: "طنجة - تطوان - الحسيمة" },
  { name: "باب برد", nameFr: "Bab Berred", slug: "bab-berred", region: "طنجة - تطوان - الحسيمة" },
  { name: "العوامرة", nameFr: "Laouamra", slug: "laouamra", region: "طنجة - تطوان - الحسيمة" },
  { name: "زعرورة", nameFr: "Zaaroura", slug: "zaaroura", region: "طنجة - تطوان - الحسيمة" },
  { name: "ملوسة", nameFr: "Melloussa", slug: "melloussa", region: "طنجة - تطوان - الحسيمة" },
  { name: "السطيحات", nameFr: "Settihate", slug: "settihate", region: "طنجة - تطوان - الحسيمة" },
  { name: "بريكشة", nameFr: "Brikcha", slug: "brikcha", region: "طنجة - تطوان - الحسيمة" },

  // ═══════════════════════════════════════════
  // 2. الشرق (25)
  // ═══════════════════════════════════════════
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
  { name: "تفرسيت", nameFr: "Tafersit", slug: "tafersit", region: "الشرق" },
  { name: "قاسيون", nameFr: "Kassita", slug: "kassita", region: "الشرق" },
  { name: "مداغ", nameFr: "Madagh", slug: "madagh", region: "الشرق" },
  { name: "بني شيكر", nameFr: "Bni Chiker", slug: "bni-chiker", region: "الشرق" },
  { name: "المطار", nameFr: "Al Matar", slug: "al-matar", region: "الشرق" },
  { name: "بوعرك", nameFr: "Bouarg", slug: "bouarg", region: "الشرق" },
  { name: "تندرارة", nameFr: "Tendrara", slug: "tendrara", region: "الشرق" },

  // ═══════════════════════════════════════════
  // 3. فاس - مكناس (32)
  // ═══════════════════════════════════════════
  { name: "فاس", nameFr: "Fès", slug: "fes", region: "فاس - مكناس" },
  { name: "مكناس", nameFr: "Meknès", slug: "meknes", region: "فاس - مكناس" },
  { name: "تازة", nameFr: "Taza", slug: "taza", region: "فاس - مكناس" },
  { name: "صفرو", nameFr: "Sefrou", slug: "sefrou", region: "فاس - مكناس" },
  { name: "إفران", nameFr: "Ifrane", slug: "ifrane", region: "فاس - مكناس" },
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
  { name: "الحاج قدور", nameFr: "Haj Kaddour", slug: "haj-kaddour", region: "فاس - مكناس" },
  { name: "رباط الخير", nameFr: "Ribat El Kheir", slug: "ribat-el-kheir", region: "فاس - مكناس" },
  { name: "عين الشكاك", nameFr: "Ain Cheggag", slug: "ain-cheggag", region: "فاس - مكناس" },
  { name: "المنزل", nameFr: "Menzel", slug: "menzel", region: "فاس - مكناس" },
  { name: "سيدي المخفي", nameFr: "Sidi Makhfi", slug: "sidi-makhfi", region: "فاس - مكناس" },
  { name: "تيسة", nameFr: "Tissa", slug: "tissa", region: "فاس - مكناس" },
  { name: "قرية با محمد", nameFr: "Karia Ba Mohamed", slug: "karia-ba-mohamed", region: "فاس - مكناس" },
  { name: "الوداية", nameFr: "Ouedaya", slug: "ouedaya", region: "فاس - مكناس" },
  { name: "عين البيضاء", nameFr: "Ain Beida", slug: "ain-beida-hajeb", region: "فاس - مكناس" },
  { name: "مولاي يعقوب", nameFr: "Moulay Yacoub", slug: "moulay-yacoub", region: "فاس - مكناس" },
  { name: "رأس الوادي", nameFr: "Ras El Oued", slug: "ras-el-oued-taza", region: "فاس - مكناس" },
  { name: "بركان (تازة)", nameFr: "Berkine", slug: "berkine", region: "فاس - مكناس" },
  { name: "سيدي حرازم", nameFr: "Sidi Harazem", slug: "sidi-harazem", region: "فاس - مكناس" },
  { name: "أكنول", nameFr: "Aknoul", slug: "aknoul", region: "فاس - مكناس" },
  { name: "بن الطيب", nameFr: "Ben Taieb", slug: "ben-taieb", region: "فاس - مكناس" },

  // ═══════════════════════════════════════════
  // 4. الرباط - سلا - القنيطرة (20)
  // ═══════════════════════════════════════════
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
  { name: "مقام الطلبة", nameFr: "Maqam Tolba", slug: "maqam-tolba", region: "الرباط - سلا - القنيطرة" },
  { name: "سيدي علال البحراوي", nameFr: "Sidi Allal El Bahraoui", slug: "sidi-allal-el-bahraoui", region: "الرباط - سلا - القنيطرة" },
  { name: "مرشوش", nameFr: "Mers El Kheir", slug: "mers-el-kheir", region: "الرباط - سلا - القنيطرة" },
  { name: "الرماني", nameFr: "Rommani", slug: "rommani", region: "الرباط - سلا - القنيطرة" },
  { name: "أولماس", nameFr: "Oulmès", slug: "oulmes", region: "الرباط - سلا - القنيطرة" },
  { name: "سيدي علال التازي", nameFr: "Sidi Allal Tazi", slug: "sidi-allal-tazi", region: "الرباط - سلا - القنيطرة" },
  { name: "سيدي الطيبي", nameFr: "Sidi Taibi", slug: "sidi-taibi", region: "الرباط - سلا - القنيطرة" },

  // ═══════════════════════════════════════════
  // 5. بني ملال - خنيفرة (20)
  // ═══════════════════════════════════════════
  { name: "بني ملال", nameFr: "Béni Mellal", slug: "beni-mellal", region: "بني ملال - خنيفرة" },
  { name: "خريبكة", nameFr: "Khouribga", slug: "khouribga", region: "بني ملال - خنيفرة" },
  { name: "الفقيه بن صالح", nameFr: "Fquih Ben Salah", slug: "fquih-ben-salah", region: "بني ملال - خنيفرة" },
  { name: "أزيلال", nameFr: "Azilal", slug: "azilal", region: "بني ملال - خنيفرة" },
  { name: "خنيفرة", nameFr: "Khénifra", slug: "khenifra", region: "بني ملال - خنيفرة" },
  { name: "وادي زم", nameFr: "Oued Zem", slug: "oued-zem", region: "بني ملال - خنيفرة" },
  { name: "قصبة تادلة", nameFr: "Kasba Tadla", slug: "kasba-tadla", region: "بني ملال - خنيفرة" },
  { name: "دمنات", nameFr: "Demnate", slug: "demnate", region: "بني ملال - خنيفرة" },
  { name: "مريرت", nameFr: "Mrirt", slug: "mrirt", region: "بني ملال - خنيفرة" },
  { name: "زاوية الشيخ", nameFr: "Zaouiat Cheikh", slug: "zaouiat-cheikh", region: "بني ملال - خنيفرة" },
  { name: "أبي الجعد", nameFr: "Bejaad", slug: "bejaad", region: "بني ملال - خنيفرة" },
  { name: "حطان", nameFr: "Hattane", slug: "hattan", region: "بني ملال - خنيفرة" },
  { name: "سيدي عياد", nameFr: "Sidi Ayyad", slug: "sidi-ayyad", region: "بني ملال - خنيفرة" },
  { name: "فم أوم الربيع", nameFr: "Foum Oum Er-Rbia", slug: "foum-oum-er-rbia", region: "بني ملال - خنيفرة" },
  { name: "تأنوبيج", nameFr: "Tanougha", slug: "tanougha", region: "بني ملال - خنيفرة" },
  { name: "سيدي جابر", nameFr: "Sidi Jaber", slug: "sidi-jaber", region: "بني ملال - خنيفرة" },
  { name: "أفورار", nameFr: "Afourar", slug: "afourar", region: "بني ملال - خنيفرة" },
  { name: "بين الويدان", nameFr: "Bin El Ouidane", slug: "bin-el-ouidane", region: "بني ملال - خنيفرة" },
  { name: "القباب", nameFr: "El Ksiba", slug: "el-ksiba", region: "بني ملال - خنيفرة" },
  { name: "أولاد عياد", nameFr: "Ouled Ayad", slug: "ouled-ayad", region: "بني ملال - خنيفرة" },

  // ═══════════════════════════════════════════
  // 6. الدار البيضاء - سطات (25)
  // ═══════════════════════════════════════════
  { name: "الدار البيضاء", nameFr: "Casablanca", slug: "casablanca", region: "الدار البيضاء - سطات" },
  { name: "المحمدية", nameFr: "Mohammedia", slug: "mohammedia", region: "الدار البيضاء - سطات" },
  { name: "الجديدة", nameFr: "El Jadida", slug: "el-jadida", region: "الدار البيضاء - سطات" },
  { name: "سطات", nameFr: "Settat", slug: "settat", region: "الدار البيضاء - سطات" },
  { name: "برشيد", nameFr: "Berrechid", slug: "berrechid", region: "الدار البيضاء - سطات" },
  { name: "بنسليمان", nameFr: "Benslimane", slug: "benslimane", region: "الدار البيضاء - سطات" },
  { name: "دار بوعزة", nameFr: "Dar Bouazza", slug: "dar-bouazza", region: "الدار البيضاء - سطات" },
  { name: "أزمور", nameFr: "Azemmour", slug: "azemmour", region: "الدار البيضاء - سطات" },
  { name: "مديونة", nameFr: "Médiouna", slug: "mediouna", region: "الدار البيضاء - سطات" },
  { name: "النواصر", nameFr: "Nouaceur", slug: "nouaceur", region: "الدار البيضاء - سطات" },
  { name: "البئر الجديد", nameFr: "Bir Jdid", slug: "bir-jdid", region: "الدار البيضاء - سطات" },
  { name: "الكارة", nameFr: "Lakhsas", slug: "lakhsas", region: "الدار البيضاء - سطات" },
  { name: "السوالم", nameFr: "Soualem", slug: "soualem", region: "الدار البيضاء - سطات" },
  { name: "الهراويين", nameFr: "Lahraouyine", slug: "lahraouyine", region: "الدار البيضاء - سطات" },
  { name: "تيط مليل", nameFr: "Tit Mellil", slug: "tit-mellil", region: "الدار البيضاء - سطات" },
  { name: "سيدي رحال الشاطئ", nameFr: "Sidi Rahal Chatai", slug: "sidi-rahal-chatai", region: "الدار البيضاء - سطات" },
  { name: "بوزنيقة", nameFr: "Bouznika", slug: "bouznika", region: "الدار البيضاء - سطات" },
  { name: "المنصورية", nameFr: "Mansouria", slug: "mansouria", region: "الدار البيضاء - سطات" },
  { name: "أولاد عياد", nameFr: "Ouled Ziane", slug: "ouled-ziane-casa", region: "الدار البيضاء - سطات" },
  { name: "سيدي بنور", nameFr: "Sidi Bennour", slug: "sidi-bennour", region: "الدار البيضاء - سطات" },
  { name: "الزمامرة", nameFr: "Zemamra", slug: "zemamra", region: "الدار البيضاء - سطات" },
  { name: "عين حرودة", nameFr: "Ain Harrouda", slug: "ain-harrouda", region: "الدار البيضاء - سطات" },
  { name: "حد السوالم", nameFr: "Had Soualem", slug: "had-soualem", region: "الدار البيضاء - سطات" },
  { name: "البروج", nameFr: "Borouj", slug: "borouj", region: "الدار البيضاء - سطات" },
  { name: "الڭارة", nameFr: "Gara", slug: "gara", region: "الدار البيضاء - سطات" },

  // ═══════════════════════════════════════════
  // 7. مراكش - آسفي (22)
  // ═══════════════════════════════════════════
  { name: "مراكش", nameFr: "Marrakech", slug: "marrakech", region: "مراكش - آسفي" },
  { name: "آسفي", nameFr: "Safi", slug: "safi", region: "مراكش - آسفي" },
  { name: "الصويرة", nameFr: "Essaouira", slug: "essaouira", region: "مراكش - آسفي" },
  { name: "قلعة السراغنة", nameFr: "Kelaa des Sraghna", slug: "kelaa-des-sraghna", region: "مراكش - آسفي" },
  { name: "اليوسفية", nameFr: "Youssoufia", slug: "youssoufia", region: "مراكش - آسفي" },
  { name: "ابن جرير", nameFr: "Ben Guerir", slug: "ben-guerir", region: "مراكش - آسفي" },
  { name: "شيشاوة", nameFr: "Chichaoua", slug: "chichaoua", region: "مراكش - آسفي" },
  { name: "تامنصورت", nameFr: "Tamansourt", slug: "tamansourt", region: "مراكش - آسفي" },
  { name: "العطاوية", nameFr: "Lattaouia", slug: "lattaouia", region: "مراكش - آسفي" },
  { name: "سيدي رحال", nameFr: "Sidi Rahal", slug: "sidi-rahal", region: "مراكش - آسفي" },
  { name: "امنتانوت", nameFr: "Imintanoute", slug: "imintanoute", region: "مراكش - آسفي" },
  { name: "تازارين", nameFr: "Tazart", slug: "tazart", region: "مراكش - آسفي" },
  { name: "أيت أورير", nameFr: "Ait Ourir", slug: "ait-ourir", region: "مراكش - آسفي" },
  { name: "تحناوت", nameFr: "Tahannaout", slug: "tahannaout", region: "مراكش - آسفي" },
  { name: "أمزميز", nameFr: "Amizmiz", slug: "amizmiz", region: "مراكش - آسفي" },
  { name: "سميمو", nameFr: "Smimou", slug: "smimou", region: "مراكش - آسفي" },
  { name: "آيت داوود", nameFr: "Ait Daoud", slug: "ait-daoud", region: "مراكش - آسفي" },
  { name: "أحد المراكش", nameFr: "Ahdil", slug: "ahdil", region: "مراكش - آسفي" },
  { name: "زاوية النحلية", nameFr: "Zaouiat Nahliya", slug: "zaouiat-nahliya", region: "مراكش - آسفي" },
  { name: "شلالات أوزود", nameFr: "Ouzoud", slug: "ouzoud", region: "مراكش - آسفي" },
  { name: "سيدي المختار", nameFr: "Sidi Mokhtar", slug: "sidi-mokhtar", region: "مراكش - آسفي" },
  { name: "آيت أورير", nameFr: "Ait Ourir Centre", slug: "ait-ourir-centre", region: "مراكش - آسفي" },

  // ═══════════════════════════════════════════
  // 8. درعة - تافيلالت (20)
  // ═══════════════════════════════════════════
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
  { name: "أيت باها", nameFr: "Ait Baha", slug: "ait-baha", region: "درعة - تافيلالت" },
  { name: "كلميمة", nameFr: "Goulmima", slug: "goulmima", region: "درعة - تافيلالت" },
  { name: "جرف", nameFr: "Jorf", slug: "jorf", region: "درعة - تافيلالت" },
  { name: "تنجداد", nameFr: "Tinejdad", slug: "tinejdad", region: "درعة - تافيلالت" },
  { name: "أغبالو", nameFr: "Agbalou", slug: "agbalou", region: "درعة - تافيلالت" },
  { name: "تسافت", nameFr: "Tassafte", slug: "tassafte", region: "درعة - تافيلالت" },
  { name: "تازارين (درعة)", nameFr: "Tazarine Dades", slug: "tazarine-dades", region: "درعة - تافيلالت" },
  { name: "الحاجب (درعة)", nameFr: "El Hajeb Dades", slug: "el-hajeb-dades", region: "درعة - تافيلالت" },
  { name: "بومالن دادس", nameFr: "Boumalne", slug: "boumalne", region: "درعة - تافيلالت" },
  { name: "ألنيف", nameFr: "Alnif", slug: "alnif", region: "درعة - تافيلالت" },

  // ═══════════════════════════════════════════
  // 9. سوس - ماسة (22)
  // ═══════════════════════════════════════════
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
  { name: "القليعة", nameFr: "Guelmim Lqliâa", slug: "lqliaa", region: "سوس - ماسة" },
  { name: "تيوغزة", nameFr: "Tioughza", slug: "tioughza", region: "سوس - ماسة" },
  { name: "إغرم", nameFr: "Ighrem", slug: "ighrem", region: "سوس - ماسة" },
  { name: "تالوين", nameFr: "Taliouine", slug: "taliouine", region: "سوس - ماسة" },
  { name: "تامري", nameFr: "Tamri", slug: "tamri", region: "سوس - ماسة" },
  { name: "إمسوان", nameFr: "Imsouane", slug: "imsouane", region: "سوس - ماسة" },
  { name: "تغازوت", nameFr: "Taghazout", slug: "taghazout", region: "سوس - ماسة" },
  { name: "أقا", nameFr: "Aqqa", slug: "aqqa", region: "سوس - ماسة" },
  { name: "فم الحصن", nameFr: "Foum El Oued", slug: "foum-el-oued", region: "سوس - ماسة" },
  { name: "أقا إيغان", nameFr: "Aqa Ighan", slug: "aqa-ighan", region: "سوس - ماسة" },
  { name: "تافراوت", nameFr: "Tafraout", slug: "tafraout", region: "سوس - ماسة" },

  // ═══════════════════════════════════════════
  // 10. كلميم - واد نون (12)
  // ═══════════════════════════════════════════
  { name: "كلميم", nameFr: "Guelmim", slug: "guelmim", region: "كلميم - واد نون" },
  { name: "طانطان", nameFr: "Tan-Tan", slug: "tan-tan", region: "كلميم - واد نون" },
  { name: "أسا", nameFr: "Assa", slug: "assa", region: "كلميم - واد نون" },
  { name: "الزاك", nameFr: "Zag", slug: "zag", region: "كلميم - واد نون" },
  { name: "سيدي إفني", nameFr: "Sidi Ifni", slug: "sidi-ifni", region: "كلميم - واد نون" },
  { name: "بويزكارن", nameFr: "Bouizakarne", slug: "bouizakarne", region: "كلميم - واد نون" },
  { name: "الأخصاص", nameFr: "Lakhsas", slug: "lakhsas-guelmim", region: "كلميم - واد نون" },
  { name: "الشبيكة", nameFr: "Chbika", slug: "chbika", region: "كلميم - واد نون" },
  { name: "تلمزون", nameFr: "Talmzoun", slug: "talmzoun", region: "كلميم - واد نون" },
  { name: "مسيد", nameFr: "Msied", slug: "msied", region: "كلميم - واد نون" },
  { name: "الوطنية", nameFr: "Fask", slug: "fask", region: "كلميم - واد نون" },
  { name: "تغجيجت", nameFr: "Taghjijt", slug: "taghjijt", region: "كلميم - واد نون" },

  // ═══════════════════════════════════════════
  // 11. العيون - الساقية الحمراء (6)
  // ═══════════════════════════════════════════
  { name: "العيون", nameFr: "Laâyoune", slug: "laayoune", region: "العيون - الساقية الحمراء" },
  { name: "السمارة", nameFr: "Smara", slug: "smara", region: "العيون - الساقية الحمراء" },
  { name: "بوجدور", nameFr: "Boujdour", slug: "boujdour", region: "العيون - الساقية الحمراء" },
  { name: "المرسى", nameFr: "El Marsa", slug: "el-marsa", region: "العيون - الساقية الحمراء" },
  { name: "طرفاية", nameFr: "Tarfaya", slug: "tarfaya", region: "العيون - الساقية الحمراء" },
  { name: "الدشيرة (العيون)", nameFr: "Dcheira Laayoune", slug: "dcheira-laayoune", region: "العيون - الساقية الحمراء" },

  // ═══════════════════════════════════════════
  // 12. الداخلة - وادي الذهب (3)
  // ═══════════════════════════════════════════
  { name: "الداخلة", nameFr: "Dakhla", slug: "dakhla", region: "الداخلة - وادي الذهب" },
  { name: "أوسرد", nameFr: "Aousserd", slug: "aousserd", region: "الداخلة - وادي الذهب" },
  { name: "الكويرة", nameFr: "Lagouira", slug: "lagouira", region: "الداخلة - وادي الذهب" },
];

// ═══════════════════════════════════════════
// Fuzzy Search
// ═══════════════════════════════════════════

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

export function searchMoroccanCities(
  query: string,
  limit = 30
): MoroccanCity[] {
  const q = normalize(query);
  if (q.length < 2) return MOROCCAN_CITIES.slice(0, limit);

  const scored = MOROCCAN_CITIES.map((city) => {
    const nAr = normalize(city.name);
    const nFr = normalize(city.nameFr);
    const nSlug = normalize(city.slug);

    if (nAr.startsWith(q) || nFr.startsWith(q)) return { city, score: 0 };
    if (nAr.includes(q) || nFr.includes(q) || nSlug.includes(q)) {
      return { city, score: 1 };
    }

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

export function getCitiesByRegion(region: string): MoroccanCity[] {
  return MOROCCAN_CITIES.filter((c) => c.region === region);
}

export function getAllRegions(): string[] {
  return Array.from(new Set(MOROCCAN_CITIES.map((c) => c.region)));
}

// ═══════════════════════════════════════════
// Aliases — أسماء بديلة للمدن الكبرى
// يضيف النظام تعرف تلقائي على نفس المدينة بين لغات مختلفة
// ═══════════════════════════════════════════

export const CITY_ALIASES: Record<string, string[]> = {
  casablanca: ["casa", "dar el beida", "dar lbeida", "ad-dar al-bayda", "dar elbida", "الدار البيضاء"],
  tanger: ["tangier", "tanja", "tanjah", "tanger"],
  marrakech: ["marrakesh", "mrrakch", "مراكش الحمراء"],
  fes: ["fez", "fès"],
  meknes: ["meknès", "meknes"],
  rabat: ["rabat"],
  sale: ["salé"],
  tetouan: ["tétouan", "titwan"],
  kenitra: ["kénitra", "qnitra"],
  agadir: ["agadir"],
  oujda: ["oujda"],
  essaouira: ["mogador"],
  "el-jadida": ["mazagan", "eljadida"],
  safi: ["asfi"],
  mohammedia: ["fedala"],
  "beni-mellal": ["béni mellal"],
  nador: ["nador"],
  khouribga: ["khouribga"],
  "el-aaiun": ["el aaiun", "العيون"],
  laayoune: ["laâyoune"],
  dakhla: ["villa cisneros"],
  guelmim: ["goulimine"],
  berkane: ["berkane"],
  "al-hoceima": ["alhoceima", "villa sanjurjo"],
  chefchaouen: ["chaouen"],
  asilah: ["arzeila"],
  "ksar-el-kebir": ["ksar el kébir", "القصر الكبير"],
  azrou: ["azrou"],
  midelt: ["midelt"],
  "sidi-kacem": ["sidi kacem"],
  "sidi-slimane": ["sidi slimane"],
  khemisset: ["khémisset"],
  temara: ["témara"],
  skhirat: ["skhirate"],
  bouznika: ["bouznika"],
  "ben-guerir": ["benguerir", "ben guerir"],
  youssoufia: ["youssoufia"],
  "fquih-ben-salah": ["fquih ben salah"],
  azilal: ["azilal"],
  "beni-ansar": ["beni ensar"],
  martil: ["martil"],
  mdiq: ["m'diq", "mdieq"],
  fnideq: ["fnidek"],
  taounate: ["taounate"],
  sefrou: ["sefrou"],
  "el-hajeb": ["elhajeb"],
  boulemane: ["boulmane"],
  figuig: ["figuig"],
  jerada: ["jerada"],
  ouezzane: ["ouazzane"],
  inezgane: ["inezgan"],
  "ait-melloul": ["aït melloul"],
  "tan-tan": ["tantan"],
  "sidi-ifni": ["sidi ifni"],
  boujdour: ["bojador"],
  smara: ["es-smara"],
  aousserd: ["aousserd"],
  zagora: ["zagora"],
  tinghir: ["tinerhir"],
  imzouren: ["imzouren"],
  azemmour: ["azamor"],
  berrechid: ["berrechid"],
  bouarfa: ["bouarfa"],
  "el-aioun-sidi-mellouk": ["el aioun sidi mellouk"],
  saidia: ["saïdia"],
  "ras-el-ma": ["ras el ma"],
  driouch: ["driouch"],
  midar: ["midar"],
  tafersit: ["tafersit"],
  kassita: ["kassita"],
  madagh: ["madagh"],
  "bni-chiker": ["bni chiker"],
  "al-matar": ["al matar"],
  bouarg: ["bouarg"],
  tendrara: ["tendrara"],
  "moulay-idriss-zerhoun": ["moulay idriss zerhoun", "مولاي إدريس"],
  missour: ["missour"],
  "outat-el-haj": ["outat el haj"],
  "ain-taoujdate": ["ain taoujdate"],
  tahla: ["tahla"],
  ghafsai: ["ghafsai"],
  bhalil: ["bhalil"],
  "imouzzer-kandar": ["imouzzer kandar"],
  "imouzzer-marmoucha": ["imouzzer marmoucha"],
  "haj-kaddour": ["haj kaddour"],
  "ribat-el-kheir": ["ribat el kheir"],
  "ain-cheggag": ["ain cheggag"],
  menzel: ["menzel"],
  "sidi-makhfi": ["sidi makhfi"],
  tissa: ["tissa"],
  "karia-ba-mohamed": ["karia ba mohamed"],
  ouedaya: ["ouedaya"],
  "moulay-yacoub": ["moulay yacoub"],
  "ras-el-oued-taza": ["ras el oued"],
  "sidi-harazem": ["sidi harazem"],
  aknoul: ["aknoul"],
  "ben-taieb": ["ben taieb"],
  tiflet: ["tiflet"],
  harhoura: ["harhoura"],
  "sidi-yahya-el-gharb": ["sidi yahya el gharb"],
  "souk-el-arbaa": ["souk el arbaa"],
  bouknadel: ["bouknadel"],
  "maqam-tolba": ["maqam tolba"],
  "sidi-allal-el-bahraoui": ["sidi allal el bahraoui"],
  "mers-el-kheir": ["mers el kheir"],
  rommani: ["rommani"],
  oulmes: ["oulmès"],
  "sidi-allal-tazi": ["sidi allal tazi"],
  "sidi-taibi": ["sidi taibi"],
  "oued-zem": ["oued zem"],
  "kasba-tadla": ["kasba tadla"],
  demnate: ["demnate"],
  mrirt: ["mrirt", "m'rirt"],
  "zaouiat-cheikh": ["zaouiat cheikh"],
  bejaad: ["bejaad"],
  hattan: ["hattan"],
  "sidi-ayyad": ["sidi ayyad"],
  "foum-oum-er-rbia": ["foum oum er rbia"],
  tanougha: ["tanougha"],
  "sidi-jaber": ["sidi jaber"],
  afourar: ["afourar"],
  "bin-el-ouidane": ["bin el ouidane"],
  "el-ksiba": ["el ksiba"],
  "ouled-ayad": ["ouled ayad"],
  benslimane: ["benslimane"],
  "dar-bouazza": ["dar bouazza"],
  mediouna: ["médiouna"],
  nouaceur: ["nouaceur"],
  "bir-jdid": ["bir jdid"],
  lakhsas: ["lakhsas"],
  soualem: ["soualem"],
  lahraouyine: ["lahraouyine"],
  "tit-mellil": ["tit mellil"],
  "sidi-rahal-chatai": ["sidi rahal chatai"],
  mansouria: ["mansouria"],
  "sidi-bennour": ["sidi bennour"],
  zemamra: ["zemamra"],
  "ain-harrouda": ["ain harrouda"],
  "had-soualem": ["had soualem"],
  borouj: ["borouj"],
  gara: ["gara"],
  chichaoua: ["chichaoua"],
  tamansourt: ["tamansourt"],
  lattaouia: ["lattaouia"],
  "sidi-rahal": ["sidi rahal"],
  imintanoute: ["imintanoute"],
  tazart: ["tazart"],
  "ait-ourir": ["ait ourir"],
  tahannaout: ["tahannaout"],
  amizmiz: ["amizmiz"],
  smimou: ["smimou"],
  "ait-daoud": ["ait daoud"],
  ahdil: ["ahdil"],
  "zaouiat-nahliya": ["zaouiat nahliya"],
  ouzoud: ["ouzoud"],
  "sidi-mokhtar": ["sidi mokhtar"],
  "ait-ourir-centre": ["ait ourir centre"],
  arfoud: ["arfoud"],
  rissani: ["rissani"],
  "kelaa-mgouna": ["kelaa mgouna"],
  "boumalne-dades": ["boumalne dades"],
  nkob: ["n'kob"],
  "ait-baha": ["ait baha"],
  goulmima: ["goulmima"],
  jorf: ["jorf"],
  tinejdad: ["tinejdad"],
  agbalou: ["agbalou"],
  tassafte: ["tassafte"],
  "tazarine-dades": ["tazarine dades"],
  "el-hajeb-dades": ["el hajeb dades"],
  boumalne: ["boumalne"],
  alnif: ["alnif"],
  tata: ["tata"],
  "ouled-teima": ["ouled teima"],
  "dcheira-el-jihadia": ["dcheira el jihadia"],
  biougra: ["biougra"],
  aourir: ["aourir"],
  drarga: ["drarga"],
  lqliaa: ["lqliâa"],
  tioughza: ["tioughza"],
  ighrem: ["ighrem"],
  taliouine: ["taliouine"],
  tamri: ["tamri"],
  imsouane: ["imsouane"],
  taghazout: ["taghazout"],
  aqqa: ["aqqa"],
  "foum-el-oued": ["foum el oued"],
  "aqa-ighan": ["aqa ighan"],
  tafraout: ["tafraout"],
  assa: ["assa"],
  zag: ["zag"],
  bouizakarne: ["bouizakarne"],
  "lakhsas-guelmim": ["lakhsas"],
  chbika: ["chbika"],
  talmzoun: ["talmzoun"],
  msied: ["msied"],
  fask: ["fask"],
  taghjijt: ["taghjijt"],
  "el-marsa": ["el marsa"],
  tarfaya: ["tarfaya"],
  "dcheira-laayoune": ["dcheira laayoune"],
  lagouira: ["lagouira"],
};

// ═══════════════════════════════════════════
// Lookup: أي اسم → slug موحّد
// ═══════════════════════════════════════════

export function normalizeForLookup(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/[ؤئء]/g, "ء")
    .replace(/[ةه]/g, "ه")
    .replace(/[\s\-_.']+/g, " ")
    .trim();
}

export function findCityCanonicalSlug(input: string): string | null {
  const q = normalizeForLookup(input);
  if (!q) return null;

  // 1) تطابق مباشر مع name / nameFr / slug
  for (const city of MOROCCAN_CITIES) {
    if (
      normalizeForLookup(city.name) === q ||
      normalizeForLookup(city.nameFr) === q ||
      normalizeForLookup(city.slug) === q
    ) {
      return city.slug;
    }
  }

  // 2) تطابق مع aliases
  for (const [slug, aliases] of Object.entries(CITY_ALIASES)) {
    for (const alias of aliases) {
      if (normalizeForLookup(alias) === q) {
        return slug;
      }
    }
  }

  return null;
}