-- AlterTable
ALTER TABLE "Lending" ADD COLUMN     "liquidation_threshold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ltv" INTEGER NOT NULL DEFAULT 0;
