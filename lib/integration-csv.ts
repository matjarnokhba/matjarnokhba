/** أدوات CSV خالية من الاعتماديات: قراءة وكتابة وكشف الأعمدة (آمنة للاستعمال في الخادم والعميل). */

export const EXPORT_HEADERS = [
  "reference",
  "order_numbers",
  "recipient_name",
  "phone",
  "city",
  "district",
  "address",
  "cod",
  "currency",
  "parcels",
  "notes",
  "shipment_id",
  "tracking",
  "status",
] as const;

function countOutsideQuotes(line: string, d: string): number {
  let q = false;
  let n = 0;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (!q && c === d) n++;
  }
  return n;
}

export function detectDelimiter(text: string): string {
  const first = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  let best = ",";
  let bestN = -1;
  for (const d of [";", ",", "\t"]) {
    const n = countOutsideQuotes(first, d);
    if (n > bestN) {
      best = d;
      bestN = n;
    }
  }
  return best;
}

export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const d = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((x) => x.trim() !== "")) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += c;
    } else if (c === '"' && cell === "") {
      q = true;
    } else if (c === d) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) pushRow();
  return rows.map((r) => r.map((x) => x.trim()));
}

/** يمنع حقن الصيغ في Excel (خلية تبدأ بـ = أو @ ...). الأرقام والهواتف تبقى كما هي. */
function guard(s: string): string {
  if (/^[=@\t\r]/.test(s)) return "'" + s;
  if (/^[+-]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s)) return "'" + s;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][], delimiter = ";"): string {
  return (
    rows
      .map((r) =>
        r
          .map((v) => {
            let s = v == null ? "" : String(v);
            s = guard(s);
            if (s.includes(delimiter) || /["\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
            return s;
          })
          .join(delimiter)
      )
      .join("\r\n") + "\r\n"
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-.]/g, "");

const ALIASES: Record<"reference" | "tracking" | "status" | "time", string[]> = {
  reference: ["reference", "ref", "référence", "reférence", "ordernumber", "orderid", "shipmentnumber", "المرجع", "مرجع", "رقمالشحنة", "رقمالطلب"],
  tracking: ["tracking", "trackingnumber", "trackingno", "awb", "barcode", "colis", "رقمالتتبع", "تتبع"],
  status: ["status", "statut", "etat", "état", "state", "الحالة", "حالة"],
  time: ["date", "datetime", "time", "updatedat", "datestatut", "statusdate", "التاريخ", "تاريخ", "وقت"],
};

export function detectColumns(headers: string[]): { reference: number; tracking: number; status: number; time: number } {
  const h = headers.map(norm);
  const find = (k: keyof typeof ALIASES) => h.findIndex((x) => ALIASES[k].includes(x));
  return { reference: find("reference"), tracking: find("tracking"), status: find("status"), time: find("time") };
}

/** ISO أو dd/mm/yyyy مع ساعة ودقيقة اختيارياً (التوقيت يُعتبر UTC إن لم يُذكر). يُرجع null لقيمة غير صالحة أو مستقبلية. */
export function parseTimeCell(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  let d: Date | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const iso = t.replace(" ", "T");
    const hasTz = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
    d = new Date(/T/.test(iso) ? (hasTz ? iso : iso + "Z") : iso + "T00:00:00Z");
  } else {
    const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
    if (m) d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)));
  }
  if (!d || isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() < 2000 || d.getTime() > Date.now() + 86400000) return null;
  return d;
}