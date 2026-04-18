#!/usr/bin/env node
/**
 * 只读探测 GitLab / Gitea 的 version API（匿名；若实例要求鉴权需自行改脚本带 Token）
 * 用法: node scripts/probe-git-api-version.mjs https://gitlab.example.com
 */
const raw = process.argv[2];
if (!raw?.trim()) {
  console.error('用法: node scripts/probe-git-api-version.mjs <实例根 URL>');
  process.exit(1);
}

let origin;
try {
  origin = new URL(raw.trim()).origin;
} catch {
  console.error('非法 URL');
  process.exit(1);
}

const candidates = [
  { label: 'GitLab /api/v4/version', url: `${origin}/api/v4/version` },
  { label: 'Gitea /api/v1/version', url: `${origin}/api/v1/version` },
];

async function main() {
  for (const { label, url } of candidates) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
      const text = await res.text();
      if (res.ok) {
        console.log(`OK ${label}\n${text}`);
        process.exit(0);
      }
    } catch {
      /* try next */
    }
  }
  console.error('未在匿名场景下命中 GitLab v4 或 Gitea v1 的 version 端点');
  process.exit(1);
}

main();
