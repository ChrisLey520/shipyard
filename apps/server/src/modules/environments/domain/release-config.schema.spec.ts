import { describe, expect, it } from 'vitest';
import { parseReleaseConfig, safeParseReleaseConfig } from './release-config.schema';

describe('releaseConfigSchema', () => {
  it('rejects kubernetes + blue_green', () => {
    const r = safeParseReleaseConfig({
      executor: 'kubernetes',
      strategy: 'blue_green',
      kubernetes: {
        namespace: 'ns',
        deploymentName: 'd',
        clusterId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects object_storage + rolling', () => {
    const r = safeParseReleaseConfig({
      executor: 'object_storage',
      strategy: 'rolling',
      objectStorage: { provider: 's3', bucket: 'b' },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts object_storage + direct + s3', () => {
    const c = parseReleaseConfig({
      executor: 'object_storage',
      strategy: 'direct',
      objectStorage: { provider: 's3', bucket: 'my-bucket', prefix: 'app/' },
    });
    expect(c.executor).toBe('object_storage');
    expect(c.objectStorage?.bucket).toBe('my-bucket');
  });

  it('accepts kubernetes additionalDeployments（同镜像多 Deployment）', () => {
    const c = parseReleaseConfig({
      executor: 'kubernetes',
      strategy: 'direct',
      kubernetes: {
        namespace: 'shipyard',
        deploymentName: 'shipyard-server',
        containerName: 'server',
        clusterId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        additionalDeployments: [
          { deploymentName: 'shipyard-worker', containerName: 'worker' },
        ],
      },
    });
    expect(c.kubernetes?.additionalDeployments?.[0]?.deploymentName).toBe('shipyard-worker');
  });

  it('accepts canary upstream_weight ssh', () => {
    const c = parseReleaseConfig({
      executor: 'ssh',
      strategy: 'canary',
      ssh: {
        nginxCanaryPath: '/etc/nginx/c.conf',
        canaryPercent: 10,
        nginxCanaryTemplate: 'upstream_weight',
        nginxCanaryUpstreamName: 'pool',
        nginxCanaryStableBackend: '10.0.0.1:80',
        nginxCanaryCandidateBackend: '10.0.0.2:80',
      },
    });
    expect(c.ssh?.nginxCanaryTemplate).toBe('upstream_weight');
  });
});
