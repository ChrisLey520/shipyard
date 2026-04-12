import { describe, expect, it } from 'vitest';
import {
  generateCanarySplitClientsFragment,
  generateCanaryUpstreamWeightFragment,
  isValidNginxBackendHostPort,
  resolveCanaryNginxBodyForDeploy,
} from './canary-nginx-fragment';

describe('generateCanarySplitClientsFragment', () => {
  it('emits split_clients with stable and candidate upstreams', () => {
    const s = generateCanarySplitClientsFragment({
      canaryPercent: 10,
      stableUpstream: 'api_stable',
      candidateUpstream: 'api_canary',
    });
    expect(s).toContain('split_clients "${remote_addr}${http_shipyard_canary_seed}" $shipyard_canary_pool {');
    expect(s).toContain('10%    api_canary;');
    expect(s).toContain('*      api_stable;');
  });

  it('clamps percent to 0–100', () => {
    const hi = generateCanarySplitClientsFragment({
      canaryPercent: 150,
      stableUpstream: 'a',
      candidateUpstream: 'b',
    });
    expect(hi).toContain('100%');
    const lo = generateCanarySplitClientsFragment({
      canaryPercent: -5,
      stableUpstream: 'a',
      candidateUpstream: 'b',
    });
    expect(lo).toContain('0%');
  });
});

describe('resolveCanaryNginxBodyForDeploy', () => {
  it('prefers manual body when non-empty', () => {
    const r = resolveCanaryNginxBodyForDeploy({
      strategy: 'canary',
      executor: 'ssh',
      ssh: {
        nginxCanaryPath: '/etc/nginx/snippets/x.conf',
        nginxCanaryBody: '  manual  ',
        canaryPercent: 50,
        nginxCanaryStableUpstream: 's',
        nginxCanaryCandidateUpstream: 'c',
      },
    });
    expect(r.kind).toBe('manual');
    expect(r.body).toBe('manual');
  });

  it('generates when body empty and fields present', () => {
    const r = resolveCanaryNginxBodyForDeploy({
      strategy: 'canary',
      executor: 'ssh',
      ssh: {
        nginxCanaryPath: '/etc/nginx/snippets/x.conf',
        canaryPercent: 5,
        nginxCanaryStableUpstream: 'st',
        nginxCanaryCandidateUpstream: 'ca',
      },
    });
    expect(r.kind).toBe('generated');
    expect(r.body).toContain('split_clients');
    expect(r.body).toContain('st');
    expect(r.body).toContain('ca');
  });

  it('returns none when strategy not canary', () => {
    expect(resolveCanaryNginxBodyForDeploy({ strategy: 'direct', executor: 'ssh' }).kind).toBe('none');
  });

  it('resolves upstream_weight template', () => {
    const r = resolveCanaryNginxBodyForDeploy({
      strategy: 'canary',
      executor: 'ssh',
      ssh: {
        nginxCanaryPath: '/x.conf',
        nginxCanaryTemplate: 'upstream_weight',
        canaryPercent: 20,
        nginxCanaryUpstreamName: 'api_pool',
        nginxCanaryStableBackend: '127.0.0.1:3000',
        nginxCanaryCandidateBackend: '127.0.0.1:3001',
      },
    });
    expect(r.kind).toBe('generated');
    expect(r.generatedTemplate).toBe('upstream_weight');
    expect(r.body).toContain('upstream api_pool');
    expect(r.body).toContain('weight=80');
    expect(r.body).toContain('weight=20');
  });
});

describe('generateCanaryUpstreamWeightFragment', () => {
  it('single stable when 0%', () => {
    const s = generateCanaryUpstreamWeightFragment({
      upstreamName: 'u',
      stableBackend: 'a:1',
      candidateBackend: 'b:2',
      canaryPercent: 0,
    });
    expect(s).toContain('server a:1;');
    expect(s).not.toContain('weight=');
  });

  it('single candidate when 100%', () => {
    const s = generateCanaryUpstreamWeightFragment({
      upstreamName: 'u',
      stableBackend: 'a:1',
      candidateBackend: 'b:2',
      canaryPercent: 100,
    });
    expect(s).toContain('server b:2;');
  });
});

describe('isValidNginxBackendHostPort', () => {
  it('accepts host:port and bracket IPv6', () => {
    expect(isValidNginxBackendHostPort('app.internal:8080')).toBe(true);
    expect(isValidNginxBackendHostPort('[::1]:9090')).toBe(true);
    expect(isValidNginxBackendHostPort('bad')).toBe(false);
  });
});
