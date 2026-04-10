-- CreateTable
CREATE TABLE "ProjectBuildEnvVariable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBuildEnvVariable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectBuildEnvVariable_projectId_idx" ON "ProjectBuildEnvVariable"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBuildEnvVariable_projectId_key_key" ON "ProjectBuildEnvVariable"("projectId", "key");

-- AddForeignKey
ALTER TABLE "ProjectBuildEnvVariable" ADD CONSTRAINT "ProjectBuildEnvVariable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

