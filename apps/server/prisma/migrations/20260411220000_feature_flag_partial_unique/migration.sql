-- 组织级（projectId IS NULL）与项目级（projectId 非空）分别唯一，避免 PostgreSQL 下 (org, NULL, key) 多行问题
CREATE UNIQUE INDEX "FeatureFlag_organizationId_key_org_scope_key" ON "FeatureFlag" ("organizationId", "key")
WHERE "projectId" IS NULL;

CREATE UNIQUE INDEX "FeatureFlag_projectId_key_project_scope_key" ON "FeatureFlag" ("projectId", "key")
WHERE "projectId" IS NOT NULL;
