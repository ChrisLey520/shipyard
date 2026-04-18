/** 校验金丝雀 upstream_weight 用的后端 `host:port`（含 IPv6 `[::1]:8080`） */
export function isValidNginxBackendHostPort(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 256) return false;
  if (/^\[[^\]]+\]:\d{1,5}$/.test(t)) return true;
  if (/^[\w.-]+:\d{1,5}$/.test(t)) return true;
  return false;
}

/**
 * upstream_weight 模板：生成完整 upstream 块。主配置 include 后：`proxy_pass http://<upstreamName>;`
 */
export function generateCanaryUpstreamWeightFragment(params: {
  upstreamName: string;
  stableBackend: string;
  candidateBackend: string;
  canaryPercent: number;
}): string {
  const p = Math.max(0, Math.min(100, Math.round(params.canaryPercent)));
  const uw = params.upstreamName;
  const sb = params.stableBackend.trim();
  const cb = params.candidateBackend.trim();
  const lines = [
    `# Shipyard: generated canary (upstream_weight). In server block use: proxy_pass http://${uw};`,
    `upstream ${uw} {`,
  ];
  if (p <= 0) {
    lines.push(`    server ${sb};`);
  } else if (p >= 100) {
    lines.push(`    server ${cb};`);
  } else {
    const wStable = 100 - p;
    const wCand = p;
    lines.push(`    server ${sb} weight=${wStable};`);
    lines.push(`    server ${cb} weight=${wCand};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

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
    nginxCanaryTemplate?: 'split_clients' | 'upstream_weight';
    nginxCanaryStableUpstream?: string;
    nginxCanaryCandidateUpstream?: string;
    nginxCanaryUpstreamName?: string;
    nginxCanaryStableBackend?: string;
    nginxCanaryCandidateBackend?: string;
  };
}): {
  body: string | null;
  kind: 'manual' | 'generated' | 'none';
  generatedTemplate?: 'split_clients' | 'upstream_weight';
} {
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
  if (!path || p === undefined) {
    return { body: null, kind: 'none' };
  }

  const tmpl = ssh.nginxCanaryTemplate ?? 'split_clients';
  if (tmpl === 'upstream_weight') {
    const uw = ssh.nginxCanaryUpstreamName?.trim();
    const sb = ssh.nginxCanaryStableBackend?.trim();
    const cb = ssh.nginxCanaryCandidateBackend?.trim();
    if (!uw || !sb || !cb) {
      return { body: null, kind: 'none' };
    }
    return {
      body: generateCanaryUpstreamWeightFragment({
        upstreamName: uw,
        stableBackend: sb,
        candidateBackend: cb,
        canaryPercent: p,
      }),
      kind: 'generated',
      generatedTemplate: 'upstream_weight',
    };
  }

  const su = ssh.nginxCanaryStableUpstream?.trim();
  const cu = ssh.nginxCanaryCandidateUpstream?.trim();
  if (!su || !cu) {
    return { body: null, kind: 'none' };
  }
  return {
    body: generateCanarySplitClientsFragment({
      canaryPercent: p,
      stableUpstream: su,
      candidateUpstream: cu,
    }),
    kind: 'generated',
    generatedTemplate: 'split_clients',
  };
}
