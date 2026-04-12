/**
 * 根据 canaryPercent 与双 upstream 名生成 Nginx split_clients 片段。
 * 主 server 块内需：proxy_pass http://$shipyard_canary_pool;
 * 可选：map $http_shipyard_canary_seed "" ""; 或 set 以固定种子（调试）。
 */
export function generateCanarySplitClientsFragment(params: {
  canaryPercent: number;
  stableUpstream: string;
  candidateUpstream: string;
}): string {
  const p = Math.max(0, Math.min(100, params.canaryPercent));
  const pctStr = Number.isInteger(p) ? String(p) : String(Math.round(p * 100) / 100).replace(/\.?0+$/, '');
  const stable = params.stableUpstream;
  const canary = params.candidateUpstream;
  return [
    '# Shipyard: generated canary (split_clients). In server block use: proxy_pass http://$shipyard_canary_pool;',
    `split_clients "\${remote_addr}\${http_shipyard_canary_seed}" $shipyard_canary_pool {`,
    `    ${pctStr}%    ${canary};`,
    `    *      ${stable};`,
    '}',
    '',
  ].join('\n');
}

/** 部署侧：解析手写或生成后的最终 Nginx 片段正文 */
export function resolveCanaryNginxBodyForDeploy(rc: {
  strategy: string;
  executor: string;
  ssh?: {
    canaryPercent?: number;
    nginxCanaryPath?: string;
    nginxCanaryBody?: string;
    nginxCanaryStableUpstream?: string;
    nginxCanaryCandidateUpstream?: string;
  };
}): { body: string | null; kind: 'manual' | 'generated' | 'none' } {
  if (rc.strategy !== 'canary' || rc.executor !== 'ssh') {
    return { body: null, kind: 'none' };
  }
  const ssh = rc.ssh ?? {};
  const manual = ssh.nginxCanaryBody?.trim();
  if (manual) {
    return { body: manual, kind: 'manual' };
  }
  const path = ssh.nginxCanaryPath?.trim();
  const p = ssh.canaryPercent;
  const su = ssh.nginxCanaryStableUpstream?.trim();
  const cu = ssh.nginxCanaryCandidateUpstream?.trim();
  if (!path || p === undefined || !su || !cu) {
    return { body: null, kind: 'none' };
  }
  return {
    body: generateCanarySplitClientsFragment({
      canaryPercent: p,
      stableUpstream: su,
      candidateUpstream: cu,
    }),
    kind: 'generated',
  };
}
