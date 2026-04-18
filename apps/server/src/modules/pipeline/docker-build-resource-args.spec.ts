import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDockerResourceArgs } from './docker-build.executor';

describe('buildDockerResourceArgs', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('默认 bridge、无 privileged', () => {
    const { args, summary } = buildDockerResourceArgs();
    expect(args).toContain('--network');
    expect(args).toContain('bridge');
    expect(summary.privileged).toBe('false');
    expect(args).not.toContain('--privileged');
  });

  it('可配置 cpus 与 memory', () => {
    vi.stubEnv('SHIPYARD_BUILD_DOCKER_CPUS', '2');
    vi.stubEnv('SHIPYARD_BUILD_DOCKER_MEMORY', '4g');
    const { args, summary } = buildDockerResourceArgs();
    expect(args).toEqual(['--network', 'bridge', '--cpus', '2', '--memory', '4g']);
    expect(summary.cpus).toBe('2');
    expect(summary.memory).toBe('4g');
  });

  it('PRIVILEGED=true 时加入 --privileged', () => {
    vi.stubEnv('SHIPYARD_BUILD_DOCKER_PRIVILEGED', 'true');
    const { args } = buildDockerResourceArgs();
    expect(args).toContain('--privileged');
  });
});
