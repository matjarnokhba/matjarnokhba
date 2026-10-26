import { NextResponse } from "next/server";
import { DocumentService } from "@/services/document.service";
import { requireSellerOwner } from "@/lib/seller-guards";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireSellerOwner();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const docId = parseInt(id);
    if (isNaN(docId)) {
      return NextResponse.json(
        { success: false, message: "معرف غير صحيح" },
        { status: 400 }
      );
    }

    await DocumentService.remove(guard.current.user.seller!.id, docId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Seller document DELETE error:", error);
    const message = error instanceof Error ? error.message : "خطأ";
    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}