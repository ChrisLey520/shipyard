import { z } from 'zod';

const sshTargetSchema = z.object({
  serverId: z.string().uuid(),
  weight: z.number().min(0).max(100).optional(),
});

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
  .strict();

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
