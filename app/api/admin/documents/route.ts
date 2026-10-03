import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { DocumentService } from "@/services/document.service";

async function requireAdmin() {
  const current = await SessionService.getCurrent();
  if (!current) return { error: "غير مصرح", status: 401 };
  if (current.user.role !== "ADMIN" && current.user.role !== "SUPER_ADMIN") {
    return { error: "غير مصرح", status: 403 };
  }
  return { user: current.user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json(
        { success: false, message: auth.error },
        { status: auth.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get("status") || "PENDING") as
      | "PENDING"
      | "APPROVED"
      | "REJECTED"
      | "ALL";

    const documents = await DocumentService.listAll(filter);
    return NextResponse.json({ success: true, documents });
  } catch (error) {
    console.error("Admin documents GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}