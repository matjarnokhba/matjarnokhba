import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { DocumentService } from "@/services/document.service";
import { isSafeDocumentUrl, whyUnsafeDocumentUrl } from "@/lib/url-safety";

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
    if (
      current.user.role !== "ADMIN" &&
      current.user.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { success: false, message: "غير مصرح" },
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

    // ═══ Proxy الملف عبر الخادم — الرابط لا يصل للمتصفح ═══
    if (!isSafeDocumentUrl(doc.storageKey)) {
      console.error("Blocked unsafe admin doc URL:", whyUnsafeDocumentUrl(doc.storageKey));
      return NextResponse.json(
        { success: false, message: "مصدر الملف غير مسموح" },
        { status: 400 }
      );
    }
    const upstream = await fetch(doc.storageKey, { redirect: "error" });
    if (!upstream.ok) {
      return NextResponse.json(
        { success: false, message: "فشل جلب الملف" },
        { status: 502 }
      );
    }

    const ext = doc.mimeType === "application/pdf" ? "pdf" : "bin";
    const filename = `document-${doc.id}.${ext}`;

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || doc.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}