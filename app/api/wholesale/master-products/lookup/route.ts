import { z } from "zod";
import {
  requireAuth,
  parseJson,
  handleError,
  ok,
} from "@/lib/api";
import { MasterProductService } from "@/services/master-product.service";

const lookupSchema = z.object({
  code: z.string().trim().min(3, "الكود يجب أن يكون 3 أحرف على الأقل").max(200),
  codeType: z.enum(["barcode", "qr"]).default("barcode"),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;

    const parsed = await parseJson(request, lookupSchema);
    if (!parsed.ok) return parsed.response;

    const { code, codeType } = parsed.data;
    const result =
      codeType === "barcode"
        ? await MasterProductService.lookupByBarcode(code)
        : await MasterProductService.lookupByQrCode(code);

    return ok({ lookup: result });
  } catch (err) {
    return handleError(err, "POST /wholesale/master-products/lookup");
  }
}