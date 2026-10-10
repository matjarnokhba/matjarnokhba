import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { DocumentService } from "@/services/document.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const current = await SessionService.getCurrent();
    if (!current) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 401 }
      );
    }
    if (!current.user.seller) {
      return NextResponse.json(
        { success: false, message: "ليس لديك متجر" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const documentId = parseInt(id);
    if (isNaN(documentId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    const doc = await DocumentService.getForDownload(documentId);
    if (!doc) {
      return NextResponse.json(
        { success: false, message: "الوثيقة غير موجودة" },
        { status: 404 }
      );
    }

    if (doc.sellerId !== current.user.seller.id) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
        { status: 403 }
      );
    }

    return NextResponse.redirect(doc.storageKey, 302);
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}