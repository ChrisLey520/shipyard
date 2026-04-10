-- AlterTable
ALTER TABLE "GitAccount" ADD COLUMN     "authType" TEXT NOT NULL DEFAULT 'pat',
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "providerAccountId" TEXT;

-- AlterTable
ALTER TABLE "GitConnection" ADD COLUMN     "gitAccountId" TEXT;

-- CreateIndex
CREATE INDEX "GitConnection_gitAccountId_idx" ON "GitConnection"("gitAccountId");

-- AddForeignKey
ALTER TABLE "GitConnection" ADD CONSTRAINT "GitConnection_gitAccountId_fkey" FOREIGN KEY ("gitAccountId") REFERENCES "GitAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
