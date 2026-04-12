import { describe, expect, it } from 'vitest';
import { generateCanarySplitClientsFragment, resolveCanaryNginxBodyForDeploy } from './canary-nginx-fragment';

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
});
