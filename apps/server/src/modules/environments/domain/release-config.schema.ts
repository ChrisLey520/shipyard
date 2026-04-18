import { z } from 'zod';

/** 与 canary-nginx-fragment.isValidNginxBackendHostPort 保持一致 */
function isValidNginxBackendHostPort(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 256) return false;
  if (/^\[[^\]]+\]:\d{1,5}$/.test(t)) return true;
  if (/^[\w.-]+:\d{1,5}$/.test(t)) return true;
  return false;
}

const sshTargetSchema = z.object({
  serverId: z.string().uuid(),
  weight: z.number().min(0).max(100).optional(),
});

/** 与主配置中 upstream 块名称一致 */
const nginxUpstreamNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '须为合法 Nginx upstream 名（字母/数字/下划线，不以数字开头）');

export const releaseConfigSchema = z
  .object({
    executor: z.enum(['ssh', 'kubernetes', 'object_storage']).default('ssh'),
    strategy: z.enum(['direct', 'blue_green', 'rolling', 'canary']).default('direct'),
    ssh: z
      .object({
        slots: z.literal(2).optional(),
        canaryPercent: z.number().min(0).max(100).optional(),
        targets: z.array(sshTargetSchema).max(32).optional(),
        primaryServerId: z.string().uuid().optional(),
        /** 金丝雀生成模板：缺省 split_clients */
        nginxCanaryTemplate: z.enum(['split_clients', 'upstream_weight']).optional(),
        /** split_clients：稳定版 upstream 名 */
        nginxCanaryStableUpstream: nginxUpstreamNameSchema.optional(),
        /** split_clients：候选版 upstream 名 */
        nginxCanaryCandidateUpstream: nginxUpstreamNameSchema.optional(),
        /** upstream_weight：生成的 upstream 块名称 */
        nginxCanaryUpstreamName: nginxUpstreamNameSchema.optional(),
        /** upstream_weight：稳定后端 host:port */
        nginxCanaryStableBackend: z.string().min(1).max(256).optional(),
        /** upstream_weight：候选后端 host:port */
        nginxCanaryCandidateBackend: z.string().min(1).max(256).optional(),
        /** 高级：金丝雀时自定义 Nginx 片段全文（原子写入 nginxCanaryPath） */
        nginxCanaryBody: z.string().max(64_000).optional(),
        nginxCanaryPath: z.string().max(512).optional(),
      })
      .optional(),
    kubernetes: z
      .object({
        namespace: z.string().min(1).max(253),
        deploymentName: z.string().min(1).max(253),
        containerName: z.string().min(1).max(253).optional(),
        clusterId: z.string().uuid(),
        /** kubectl rollout status --timeout（秒），60–3600 */
        rolloutTimeoutSeconds: z.number().int().min(60).max(3600).optional(),
        /** strategy=rolling 时 strategic patch，如 25%、1 */
        rollingUpdateMaxSurge: z.string().min(1).max(32).optional(),
        rollingUpdateMaxUnavailable: z.string().min(1).max(32).optional(),
        /**
         * 与主 Deployment 使用同一镜像的其它 Deployment（如 API + Worker）。
         * 按数组顺序依次 patch（若 rolling）→ set image → rollout status。
         */
        additionalDeployments: z
          .array(
            z.object({
              deploymentName: z.string().min(1).max(253),
              containerName: z.string().min(1).max(253).optional(),
            }),
          )
          .max(16)
          .optional(),
      })
      .optional(),
    objectStorage: z
      .object({
        provider: z.enum(['s3']),
        bucket: z.string().min(1).max(253),
        prefix: z.string().max(500).optional(),
        region: z.string().max(64).optional(),
        /** 服务端 encrypt 写入的 JSON：accessKeyId / secretAccessKey */
        credentialsEncrypted: z.string().min(1).optional(),
      })
      .optional(),
    gates: z
      .object({
        prometheus: z
          .object({
            queryUrl: z
              .string()
              .url()
              .max(2048)
              .refine((u) => u.startsWith('https://'), 'Prometheus queryUrl 仅允许 https'),
            maxSampleValue: z.number().optional(),
            /** 指标须 <= 该值才通过（如错误率上限） */
            passIfBelowOrEqual: z.boolean().optional(),
          })
          .optional(),
      })
      .optional(),
    hooks: z
      .object({
        preDeploy: z.array(z.string().max(4096)).max(20).optional(),
        postDeploy: z.array(z.string().max(4096)).max(20).optional(),
      })
      .optional(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    if (cfg.executor === 'kubernetes' && cfg.strategy === 'canary') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kubernetes 执行器暂不支持 strategy=canary，请改为 direct/rolling 或使用 SSH',
        path: ['strategy'],
      });
    }

    if (cfg.executor === 'kubernetes' && cfg.strategy === 'blue_green') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Kubernetes 执行器暂不支持 strategy=blue_green，请改为 direct/rolling 或使用 SSH',
        path: ['strategy'],
      });
    }

    if (cfg.executor === 'object_storage') {
      if (cfg.strategy !== 'direct') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'object_storage 执行器仅支持 strategy=direct',
          path: ['strategy'],
        });
      }
      const os = cfg.objectStorage;
      if (!os?.bucket?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'object_storage 须配置 objectStorage.bucket',
          path: ['objectStorage', 'bucket'],
        });
      }
      if (os && os.provider !== 's3') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '当前仅支持 objectStorage.provider=s3',
          path: ['objectStorage', 'provider'],
        });
      }
    }

    if (cfg.strategy !== 'canary' || cfg.executor !== 'ssh') return;

    const ssh = cfg.ssh;
    const path = ssh?.nginxCanaryPath?.trim() ?? '';
    if (!path) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'canary 策略须配置 ssh.nginxCanaryPath',
        path: ['ssh', 'nginxCanaryPath'],
      });
      return;
    }

    const body = ssh?.nginxCanaryBody?.trim() ?? '';
    if (body.length > 0) {
      return;
    }

    const p = ssh?.canaryPercent;
    if (p === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'canary 生成模式须配置 ssh.canaryPercent（0–100）',
        path: ['ssh', 'canaryPercent'],
      });
      return;
    }

    const tmpl = ssh?.nginxCanaryTemplate ?? 'split_clients';
    if (tmpl === 'upstream_weight') {
      const uw = ssh?.nginxCanaryUpstreamName?.trim() ?? '';
      const sb = ssh?.nginxCanaryStableBackend?.trim() ?? '';
      const cb = ssh?.nginxCanaryCandidateBackend?.trim() ?? '';
      if (!uw) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'upstream_weight 模板须配置 ssh.nginxCanaryUpstreamName',
          path: ['ssh', 'nginxCanaryUpstreamName'],
        });
      }
      if (!sb) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'upstream_weight 模板须配置 ssh.nginxCanaryStableBackend（host:port）',
          path: ['ssh', 'nginxCanaryStableBackend'],
        });
      } else if (!isValidNginxBackendHostPort(sb)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ssh.nginxCanaryStableBackend 须为合法 host:port',
          path: ['ssh', 'nginxCanaryStableBackend'],
        });
      }
      if (!cb) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'upstream_weight 模板须配置 ssh.nginxCanaryCandidateBackend（host:port）',
          path: ['ssh', 'nginxCanaryCandidateBackend'],
        });
      } else if (!isValidNginxBackendHostPort(cb)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ssh.nginxCanaryCandidateBackend 须为合法 host:port',
          path: ['ssh', 'nginxCanaryCandidateBackend'],
        });
      }
      return;
    }

    const su = ssh?.nginxCanaryStableUpstream?.trim() ?? '';
    const cu = ssh?.nginxCanaryCandidateUpstream?.trim() ?? '';
    if (!su) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'split_clients 生成模式须配置 ssh.nginxCanaryStableUpstream',
        path: ['ssh', 'nginxCanaryStableUpstream'],
      });
    }
    if (!cu) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'split_clients 生成模式须配置 ssh.nginxCanaryCandidateUpstream',
        path: ['ssh', 'nginxCanaryCandidateUpstream'],
      });
    }
    if (su && cu && su === cu) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'stable 与 candidate upstream 名不得相同',
        path: ['ssh', 'nginxCanaryCandidateUpstream'],
      });
    }
  });

export type ReleaseConfig = z.infer<typeof releaseConfigSchema>;

/** 解析并合并默认值；非法则抛错供 BadRequest 使用 */
export function parseReleaseConfig(raw: unknown): ReleaseConfig {
  return releaseConfigSchema.parse(raw ?? {});
}

export function safeParseReleaseConfig(
  raw: unknown,
): { ok: true; data: ReleaseConfig } | { ok: false; error: string } {
  try {
    return { ok: true, data: parseReleaseConfig(raw) };
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.errors.map((x) => x.message).join('; ') : String(e);
    return { ok: false, error: msg };
  }
}
