-- CreateTable
CREATE TABLE "GitAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gitProvider" TEXT NOT NULL,
    "baseUrl" TEXT,
    "accessToken" TEXT NOT NULL,
    "gitUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GitAccount_organizationId_idx" ON "GitAccount"("organizationId");

-- CreateIndex
CREATE INDEX "GitAccount_gitProvider_idx" ON "GitAccount"("gitProvider");

-- CreateIndex
CREATE UNIQUE INDEX "GitAccount_organizationId_name_key" ON "GitAccount"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "GitAccount" ADD CONSTRAINT "GitAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

