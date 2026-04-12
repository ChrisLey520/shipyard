import { z } from 'zod';

const eventTypes = [
  'error',
  'resource_error',
  'http_error',
  'http_slow',
  'web_vital',
  'timing',
  'healthcheck',
  'custom',
] as const;

const breadcrumbSchema = z.object({
  t: z.string(),
  category: z.string(),
  message: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const monitoringEventSchema = z
  .object({
    eventId: z.string().min(8).max(64),
    type: z.enum(eventTypes),
    timestamp: z.string(),
    platform: z.string().min(1).max(64),
    sdkVersion: z.string().min(1).max(32),
    sessionId: z.string().min(4).max(128),
    payload: z.record(z.unknown()),
    release: z.string().max(128).optional(),
    env: z.string().max(32).optional(),
    userId: z.string().max(128).optional(),
    route: z.string().max(2048).optional(),
    device: z.record(z.unknown()).optional(),
    network: z.string().max(32).optional(),
    sampleRate: z.number().min(0).max(1).optional(),
    breadcrumbs: z.array(breadcrumbSchema).max(50).optional(),
  })
  .strict();

export const ingestBatchSchema = z
  .object({
    projectKey: z.string().min(1).max(128),
    events: z.array(monitoringEventSchema).min(1).max(100),
  })
  .strict();

export type IngestBatchInput = z.infer<typeof ingestBatchSchema>;
