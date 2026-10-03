import { NextResponse } from "next/server";
import { z } from "zod";
import { SessionService } from "@/services/session.service";
import { DocumentService } from "@/services/document.service";

async function requireSeller() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (!current.user.seller) return { error: "ليس لديك متجر", status: 403 };
  return { user: current.user, seller: current.user.seller };
}

const createSchema = z.object({
  type: z.enum([
    "CIN",
    "PASSPORT",
    "ICE",
    "RC",
    "IF",
    "BANK_STATEMENT",
    "ADDRESS_PROOF",
    "OTHER",
  ]),
  storageKey: z.string().url(),
  mimeType: z.string().min(3),
  sizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
  notes: z.string().trim().max(500).optional(),
});

export async function GET() {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const documents = await DocumentService.list(auth.seller.id);
    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("Seller documents GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSeller();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "بيانات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const doc = await DocumentService.create(auth.seller.id, parsed.data);

    return NextResponse.json(
      { success: true, document: { id: doc.id, type: doc.type } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Seller document POST error:", error);
    const message = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}