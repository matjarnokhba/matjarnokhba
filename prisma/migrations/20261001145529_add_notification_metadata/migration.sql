-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "category" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "severity" TEXT DEFAULT 'INFO';

-- CreateIndex
CREATE INDEX "Notification_category_idx" ON "Notification"("category");

-- CreateIndex
CREATE INDEX "Notification_severity_idx" ON "Notification"("severity");

-- CreateIndex
CREATE INDEX "Notification_userId_category_isRead_idx" ON "Notification"("userId", "category", "isRead");
