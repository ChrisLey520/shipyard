import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { isBlockedOutboundIp } from '@shipyard/shared';

/**
 * 解析 URL 主机名全部 A/AAAA，任一命中私网/保留段则拒绝（通知类出站 SSRF）
 */
export async function assertSafeOutboundHttpUrl(urlStr: string): Promise<URL> {
  const u = new URL(urlStr);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('仅允许 http(s) URL');
  }
  const host = u.hostname;
  if (!host) throw new Error('无效主机名');

  const fam = net.isIP(host);
  const toCheck: string[] = [];
  if (fam === 4 || fam === 6) {
    toCheck.push(host);
  } else {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    for (const r of records) {
      toCheck.push(r.address);
    }
  }

  if (toCheck.length === 0) throw new Error('DNS 无解析结果');

  for (const addr of toCheck) {
    if (isBlockedOutboundIp(addr)) {
      throw new Error(`SSRF 防护：禁止访问 ${addr}`);
    }
  }

  return u;
}
