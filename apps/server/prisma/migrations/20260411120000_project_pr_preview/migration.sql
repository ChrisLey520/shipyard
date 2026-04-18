-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "previewEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "previewServerId" TEXT,
ADD COLUMN     "previewBaseDomain" TEXT;

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "previewPortMin" INTEGER,
ADD COLUMN     "previewPortMax" INTEGER;

-- CreateIndex
CREATE INDEX "Project_previewServerId_idx" ON "Project"("previewServerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_previewServerId_fkey" FOREIGN KEY ("previewServerId") REFERENCES "Server"("id") ON DELETE SET NULL ON UPDATE CASCADE;
