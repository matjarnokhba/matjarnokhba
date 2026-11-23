import { prisma } from "@/lib/prisma";
import { requireAdmin, parseJson, ok, fail, handleError } from "@/lib/api/handler";
import { bannerUpdateSchema, bannerData } from "@/lib/banner-schema";

async function readId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const id = await readId(params);
    if (!id) return fail("معرف غير صحيح", 400);

    const parsed = await parseJson(request, bannerUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const d = parsed.data;

    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) return fail("البانر غير موجود", 404);

    const starts = d.startsAt === undefined ? existing.startsAt : d.startsAt ? new Date(d.startsAt) : null;
    const ends = d.endsAt === undefined ? existing.endsAt : d.endsAt ? new Date(d.endsAt) : null;
    if (starts && ends && ends.getTime() <= starts.getTime()) {
      return fail("تاريخ النهاية يجب أن يكون بعد تاريخ البداية", 400);
    }

    const banner = await prisma.banner.update({ where: { id }, data: bannerData(d) });
    return ok({ banner });
  } catch (err) {
    return handleError(err, "admin-banners-patch");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
    const id = await readId(params);
    if (!id) return fail("معرف غير صحيح", 400);

    const existing = await prisma.banner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return fail("البانر غير موجود", 404);

    await prisma.banner.delete({ where: { id } });
    return ok({});
  } catch (err) {
    return handleError(err, "admin-banners-delete");
  }
}