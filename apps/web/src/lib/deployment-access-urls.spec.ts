import { describe, expect, it } from 'vitest';
import {
  buildPm2StaticAccessUrlFromSnapshot,
  buildPrimarySiteAccessUrl,
  pickSecondaryAccessUrl,
  readShipyardAccess,
} from './deployment-access-urls';

describe('readShipyardAccess', () => {
  it('缺失或非法 shipyardAccess 时返回 null', () => {
    expect(readShipyardAccess(undefined)).toBeNull();
    expect(readShipyardAccess(null)).toBeNull();
    expect(readShipyardAccess({})).toBeNull();
    expect(readShipyardAccess({ shipyardAccess: 'x' })).toBeNull();
    expect(readShipyardAccess({ shipyardAccess: [] })).toBeNull();
    expect(readShipyardAccess({ shipyardAccess: { staticHost: 'h' } })).toBeNull();
    expect(readShipyardAccess({ shipyardAccess: { staticPort: 1 } })).toBeNull();
  });

  it('合法对象返回元数据', () => {
    expect(readShipyardAccess({ shipyardAccess: { staticHost: '1.2.3.4', staticPort: 5173 } })).toEqual({
      staticHost: '1.2.3.4',
      staticPort: 5173,
    });
  });
});

describe('buildPm2StaticAccessUrlFromSnapshot', () => {
  it('无元数据时返回空串', () => {
    expect(buildPm2StaticAccessUrlFromSnapshot({}, null)).toBe('');
  });

  it('有元数据时生成 http 根 URL', () => {
    const snap = { shipyardAccess: { staticHost: '127.0.0.1', staticPort: 4000 } };
    expect(buildPm2StaticAccessUrlFromSnapshot(snap, null)).toBe('http://127.0.0.1:4000/');
  });
});

describe('buildPrimarySiteAccessUrl', () => {
  it('空域名返回空串', () => {
    expect(buildPrimarySiteAccessUrl(null, null)).toBe('');
    expect(buildPrimarySiteAccessUrl('  ', null)).toBe('');
  });

  it('有域名时规范化根 URL', () => {
    expect(buildPrimarySiteAccessUrl('app.example.com', null)).toBe('http://app.example.com/');
  });
});

describe('pickSecondaryAccessUrl', () => {
  it('无健康检查 URL 时返回空串', () => {
    expect(pickSecondaryAccessUrl('http://x/', '')).toBe('');
  });

  it('无主站时直接返回健康检查 URL', () => {
    expect(pickSecondaryAccessUrl('', 'https://hc/')).toBe('https://hc/');
  });

  it('与主站去尾斜杠后相同则省略', () => {
    expect(pickSecondaryAccessUrl('http://x/', 'http://x')).toBe('');
    expect(pickSecondaryAccessUrl('http://x/', 'http://x///')).toBe('');
  });

  it('不同时保留健康检查 URL', () => {
    expect(pickSecondaryAccessUrl('http://x/', 'https://other/api/health')).toBe('https://other/api/health');
  });
});
