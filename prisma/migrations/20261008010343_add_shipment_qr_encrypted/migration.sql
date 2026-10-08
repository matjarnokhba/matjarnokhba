/*
  Warnings:

  - Added the required column `qrTokenEncrypted` to the `Shipment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "qrTokenEncrypted" BYTEA NOT NULL;
