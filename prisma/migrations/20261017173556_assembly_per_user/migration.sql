/*
  Warnings:

  - You are about to drop the column `orderId` on the `AssemblyFile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `AssemblyFile` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "AssemblyFile" DROP CONSTRAINT "AssemblyFile_orderId_fkey";

-- DropForeignKey
ALTER TABLE "AssemblyFile" DROP CONSTRAINT "AssemblyFile_userId_fkey";

-- DropIndex
DROP INDEX "AssemblyFile_orderId_key";

-- AlterTable
ALTER TABLE "AssemblyFile" DROP COLUMN "orderId";

-- CreateIndex
CREATE UNIQUE INDEX "AssemblyFile_userId_key" ON "AssemblyFile"("userId");

-- AddForeignKey
ALTER TABLE "AssemblyFile" ADD CONSTRAINT "AssemblyFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
