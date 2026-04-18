-- AlterTable
ALTER TABLE "Environment" ADD COLUMN     "releaseConfig" JSONB,
ADD COLUMN     "blueGreenActiveSlot" INTEGER;

-- AlterTable
ALTER TABLE "PipelineConfig" ADD COLUMN     "containerImageEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "containerImageName" TEXT,
ADD COLUMN     "containerRegistryAuthEncrypted" TEXT;

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "containerImageDigest" TEXT,
ADD COLUMN     "containerImageRef" TEXT;

-- AlterTable
ALTER TABLE "BuildArtifact" ADD COLUMN     "imageDigest" TEXT,
ADD COLUMN     "imageRef" TEXT;

-- CreateTable
CREATE TABLE "EnvironmentServer" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "EnvironmentServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KubernetesCluster" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kubeconfigEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KubernetesCluster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentServer_environmentId_serverId_key" ON "EnvironmentServer"("environmentId", "serverId");

-- CreateIndex
CREATE INDEX "EnvironmentServer_environmentId_sortOrder_idx" ON "EnvironmentServer"("environmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "FeatureFlag_organizationId_projectId_key_idx" ON "FeatureFlag"("organizationId", "projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "KubernetesCluster_organizationId_name_key" ON "KubernetesCluster"("organizationId", "name");

-- CreateIndex
CREATE INDEX "KubernetesCluster_organizationId_idx" ON "KubernetesCluster"("organizationId");

-- AddForeignKey
ALTER TABLE "EnvironmentServer" ADD CONSTRAINT "EnvironmentServer_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentServer" ADD CONSTRAINT "EnvironmentServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KubernetesCluster" ADD CONSTRAINT "KubernetesCluster_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 回填：每环境一条 EnvironmentServer，与现有 serverId 对齐
INSERT INTO "EnvironmentServer" ("id", "environmentId", "serverId", "sortOrder", "weight")
SELECT gen_random_uuid()::text, e."id", e."serverId", 0, 100
FROM "Environment" e;
