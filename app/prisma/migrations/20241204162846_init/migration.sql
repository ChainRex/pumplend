-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 9,
    "treasuryCapHolderId" TEXT NOT NULL,
    "collateralId" TEXT NOT NULL,
    "metadataId" TEXT NOT NULL,
    "totalSupply" BIGINT NOT NULL DEFAULT 0,
    "collectedSui" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'FUNDING',
    "poolId" TEXT,
    "positionId" TEXT,
    "tickLower" DOUBLE PRECISION,
    "tickUpper" DOUBLE PRECISION,
    "liquidity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_type_key" ON "Token"("type");
