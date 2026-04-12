-- 环境级特性开关：可空 environmentId + 收紧组织/项目部分唯一条件 + 环境级部分唯一

-- AlterTable
ALTER TABLE "FeatureFlag" ADD COLUMN "environmentId" TEXT;

-- CreateIndex
CREATE INDEX "FeatureFlag_environmentId_idx" ON "FeatureFlag"("environmentId");

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex（将由带 environmentId 条件的新索引替换）
DROP INDEX IF EXISTS "FeatureFlag_organizationId_key_org_scope_key";
DROP INDEX IF EXISTS "FeatureFlag_projectId_key_project_scope_key";

-- CreateIndex（组织级：无项目、无环境）
CREATE UNIQUE INDEX "FeatureFlag_organizationId_key_org_scope_key" ON "FeatureFlag" ("organizationId", "key")
WHERE "projectId" IS NULL AND "environmentId" IS NULL;

-- CreateIndex（项目级：有项目、无环境）
CREATE UNIQUE INDEX "FeatureFlag_projectId_key_project_scope_key" ON "FeatureFlag" ("projectId", "key")
WHERE "projectId" IS NOT NULL AND "environmentId" IS NULL;

-- CreateIndex（环境级）
CREATE UNIQUE INDEX "FeatureFlag_environmentId_key_env_scope_key" ON "FeatureFlag" ("environmentId", "key")
WHERE "environmentId" IS NOT NULL;
