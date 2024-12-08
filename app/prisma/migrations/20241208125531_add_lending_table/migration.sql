-- CreateTable
CREATE TABLE "Lending" (
    "id" TEXT NOT NULL,
    "tokenType" TEXT NOT NULL,
    "lendingPoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lending_tokenType_key" ON "Lending"("tokenType");

-- AddForeignKey
ALTER TABLE "Lending" ADD CONSTRAINT "Lending_tokenType_fkey" FOREIGN KEY ("tokenType") REFERENCES "Token"("type") ON DELETE RESTRICT ON UPDATE CASCADE;
