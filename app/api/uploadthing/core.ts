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
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;