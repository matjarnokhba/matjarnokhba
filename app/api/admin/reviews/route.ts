import { NextResponse } from "next/server";
import { SessionService } from "@/services/session.service";
import { ReviewService } from "@/services/review.service";

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
    const filterParam = searchParams.get("filter") || "PENDING";
    const filter = ["PENDING", "APPROVED", "ALL"].includes(filterParam)
      ? (filterParam as "PENDING" | "APPROVED" | "ALL")
      : "PENDING";

    const [reviews, stats] = await Promise.all([
      ReviewService.getAllForAdmin(filter),
      ReviewService.getStats(),
    ]);

    return NextResponse.json({ success: true, reviews, stats });
  } catch (error) {
    console.error("Admin reviews GET error:", error);
    return NextResponse.json(
      { success: false, message: "حدث خطأ" },
      { status: 500 }
    );
  }
}