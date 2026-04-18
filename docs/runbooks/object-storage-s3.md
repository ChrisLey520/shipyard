# 对象存储部署（S3 兼容）

## 条件

- 环境 `releaseConfig`：`executor: "object_storage"`，`strategy` **仅** `"direct"`。
- Build Worker 已安装 **AWS CLI**（`aws`），且能访问目标区域与 Bucket（网络 / IAM / 密钥）。

## 配置字段

- `objectStorage.provider`：当前仅 `"s3"`（含 S3 兼容端点时可后续扩展，本期以官方 AWS CLI 为准）。
- `objectStorage.bucket`：必填。
- `objectStorage.prefix`：可选，对象键前缀（如 `prod/app/`）。
- `objectStorage.region`：可选，写入进程环境 `AWS_REGION` / `AWS_DEFAULT_REGION`。
- `objectStorage.credentialsEncrypted`：可选；为服务端 **encrypt** 后的密文，解密后为 JSON：`{ "accessKeyId": "...", "secretAccessKey": "..." }`。**勿**在部署日志中打印明文。

未配置 `credentialsEncrypted` 时，使用与 AWS SDK/CLI 一致的 **默认凭证链**（环境变量、实例角色等）。

## 行为

1. 与 SSH/K8s 相同：从构建产物 tarball **解压到 Worker 临时目录**。
2. 执行：`aws s3 sync <临时目录> s3://<bucket>/<prefix> --delete`。
3. 之后仍执行环境的 **健康检查 URL** 与 **Prometheus 门禁**（若配置）。

## 限制

- 本期不执行 CDN 失效；不校验 Bucket 策略是否允许公共读。
- 若 Bucket 由 Terraform/GitOps 强管控，请勿在同一资源上并行人工改策略导致漂移。
