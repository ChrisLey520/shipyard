import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as dns from 'node:dns/promises';
import { assertSafeOutboundHttpUrl } from './outbound-url-guard';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

describe('assertSafeOutboundHttpUrl', () => {
  const lookup = vi.mocked(dns.lookup);

  beforeEach(() => {
    lookup.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('字面公网 IPv4 通过', async () => {
    const u = await assertSafeOutboundHttpUrl('https://8.8.8.8/hook');
    expect(u.hostname).toBe('8.8.8.8');
  });

  it('字面私网 IPv4 拒绝', async () => {
    await expect(assertSafeOutboundHttpUrl('http://10.0.0.1/x')).rejects.toThrow(/SSRF/);
  });

  it('非 http(s) 拒绝', async () => {
    await expect(assertSafeOutboundHttpUrl('ftp://example.com/')).rejects.toThrow(/仅允许/);
  });

  it('多解析结果任一为私网则拒绝', async () => {
    lookup.mockResolvedValueOnce([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ] as unknown as dns.LookupAddress[]);

    await expect(assertSafeOutboundHttpUrl('https://dual.example/hook')).rejects.toThrow(/SSRF/);
    expect(lookup).toHaveBeenCalledWith('dual.example', { all: true, verbatim: true });
  });

  it('多解析结果均为公网则通过', async () => {
    lookup.mockResolvedValueOnce([
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ] as unknown as dns.LookupAddress[]);

    const u = await assertSafeOutboundHttpUrl('https://ok.example/hook');
    expect(u.hostname).toBe('ok.example');
  });
});
