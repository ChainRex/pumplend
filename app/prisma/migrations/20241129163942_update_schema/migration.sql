/*
  Warnings:

  - You are about to drop the column `address` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the `Pool` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Transaction` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[type]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `poolId` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `treasuryCapHolderId` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Token` table without a default value. This is not possible if the table is not empty.
  - Made the column `icon` on table `Token` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Pool" DROP CONSTRAINT "Pool_tokenId_fkey";

-- DropIndex
DROP INDEX "Token_address_key";

-- AlterTable
ALTER TABLE "Token" DROP COLUMN "address",
ADD COLUMN     "poolId" TEXT NOT NULL,
ADD COLUMN     "treasuryCapHolderId" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL,
ALTER COLUMN "icon" SET NOT NULL;

-- DropTable
DROP TABLE "Pool";

-- DropTable
DROP TABLE "Transaction";

-- CreateIndex
CREATE UNIQUE INDEX "Token_type_key" ON "Token"("type");
