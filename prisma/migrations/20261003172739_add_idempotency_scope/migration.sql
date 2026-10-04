/*
  Warnings:

  - A unique constraint covering the columns `[userId,endpoint,key]` on the table `IdempotencyKey` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `IdempotencyKey` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "IdempotencyKey_key_key";

-- AlterTable
ALTER TABLE "IdempotencyKey" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "IdempotencyKey_userId_endpoint_idx" ON "IdempotencyKey"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_userId_endpoint_key_key" ON "IdempotencyKey"("userId", "endpoint", "key");
