-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "liquidity" TEXT,
ADD COLUMN     "poolId" TEXT,
ADD COLUMN     "positionId" TEXT,
ADD COLUMN     "tickLower" DOUBLE PRECISION,
ADD COLUMN     "tickUpper" DOUBLE PRECISION;
