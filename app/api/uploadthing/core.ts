import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { SessionService } from "@/services/session.service";

const f = createUploadthing();

export const ourFileRouter = {
  // ═══ صور المنتجات ═══
  imageUploader: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 5,
    },
  })
    .middleware(async () => {
      const current = await SessionService.getCurrent();
      if (!current) throw new UploadThingError("غير مصرح");

      const isAdmin =
        current.user.role === "ADMIN" ||
        current.user.role === "SUPER_ADMIN";
      const isSeller =
        current.user.role === "SELLER" && current.user.seller;

      if (!isAdmin && !isSeller) {
        throw new UploadThingError("غير مصرح");
      }

      return {
        userId: current.user.id,
        sellerId: current.user.seller?.id || null,
        role: current.user.role,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // ═══ وثائق التاجر ═══
  documentUploader: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const current = await SessionService.getCurrent();
      if (!current) throw new UploadThingError("غير مصرح");

      if (current.user.role !== "SELLER" || !current.user.seller) {
        throw new UploadThingError("غير مصرح — للتجار فقط");
      }

      return {
        userId: current.user.id,
        sellerId: current.user.seller.id,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.userId,
        sellerId: metadata.sellerId,
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
      };
    }),
  // ═══ أدلة الإرجاع (العميل): صور أو فيديو ═══
  returnEvidenceUploader: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
    video: { maxFileSize: "32MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const current = await SessionService.getCurrent();
      if (!current) throw new UploadThingError("يجب تسجيل الدخول");
      return { userId: current.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url, name: file.name };
    }),
  // ═══ صور التجهيز قبل التسليم للمجمّع (البائع وموظفوه المخوّلون) ═══
  prepPhotoUploader: f({
    image: { maxFileSize: "8MB", maxFileCount: 5 },
  })
    .middleware(async () => {
      const current = await SessionService.getCurrent();
      if (!current) throw new UploadThingError("غير مصرح");
      const seller = current.user.seller;
      if (!seller || seller.status === "SUSPENDED" || seller.status === "CLOSED") {
        throw new UploadThingError("غير مصرح — للتجار فقط");
      }
      if (!current.user.isSellerOwner && !current.user.staffPermissions.includes("MANAGE_FULFILLMENTS")) {
        throw new UploadThingError("لا تملك صلاحية إدارة التجهيزات");
      }
      return { userId: current.user.id, sellerId: seller.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, sellerId: metadata.sellerId, url: file.url, name: file.name };
    }),// ═══ صورة البطاقة الوطنية لاسترداد المبلغ عبر وكالة (اختيارية، للزبون المسجّل) ═══
  returnCinUploader: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const current = await SessionService.getCurrent();
      if (!current) throw new UploadThingError("يجب تسجيل الدخول");
      return { userId: current.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.url, name: file.name };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;