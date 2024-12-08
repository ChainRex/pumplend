/*
  Warnings:

  - You are about to drop the column `tokenType` on the `Lending` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[type]` on the table `Lending` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `icon` to the `Lending` table without a default value. This is not possible if the table is not empty.
  - Added the required column `metadataId` to the `Lending` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Lending` table without a default value. This is not possible if the table is not empty.
  - Added the required column `symbol` to the `Lending` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Lending` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Lending" DROP CONSTRAINT "Lending_tokenType_fkey";

-- DropIndex
DROP INDEX "Lending_tokenType_key";

-- AlterTable
ALTER TABLE "Lending" DROP COLUMN "tokenType",
ADD COLUMN     "decimals" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "icon" TEXT NOT NULL,
ADD COLUMN     "metadataId" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "symbol" TEXT NOT NULL,
ADD COLUMN     "type" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Lending_type_key" ON "Lending"("type");
