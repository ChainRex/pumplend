/*
  Warnings:

  - Added the required column `metadataId` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "collectedSui" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "metadataId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'FUNDING',
ADD COLUMN     "totalSupply" BIGINT NOT NULL DEFAULT 0;
