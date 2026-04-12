import { z } from 'zod';

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
    executor: z.enum(['ssh', 'kubernetes']).default('ssh'),
    strategy: z.enum(['direct', 'blue_green', 'rolling', 'canary']).default('direct'),
    ssh: z
      .object({
        slots: z.literal(2).optional(),
        canaryPercent: z.number().min(0).max(100).optional(),
        targets: z.array(sshTargetSchema).max(32).optional(),
        primaryServerId: z.string().uuid().optional(),
        /** split_clients 生成模式：稳定版 upstream 名 */
        nginxCanaryStableUpstream: nginxUpstreamNameSchema.optional(),
        /** split_clients 生成模式：候选版 upstream 名 */
        nginxCanaryCandidateUpstream: nginxUpstreamNameSchema.optional(),
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
    const su = ssh?.nginxCanaryStableUpstream?.trim() ?? '';
    const cu = ssh?.nginxCanaryCandidateUpstream?.trim() ?? '';
    if (p === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'canary 生成模式须配置 ssh.canaryPercent（0–100）',
        path: ['ssh', 'canaryPercent'],
      });
    }
    if (!su) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'canary 生成模式须配置 ssh.nginxCanaryStableUpstream',
        path: ['ssh', 'nginxCanaryStableUpstream'],
      });
    }
    if (!cu) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'canary 生成模式须配置 ssh.nginxCanaryCandidateUpstream',
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
