import { describe, expect, it } from 'vitest';
import { buildPm2StaticSiteRootUrl, normalizeHttpRootUrlWithSlash, stripTrailingSlashes } from './utils';

describe('stripTrailingSlashes', () => {
  it('去掉末尾斜杠', () => {
    expect(stripTrailingSlashes('')).toBe('');
    expect(stripTrailingSlashes('https://a')).toBe('https://a');
    expect(stripTrailingSlashes('https://a/')).toBe('https://a');
    expect(stripTrailingSlashes('https://a///')).toBe('https://a');
  });
});

describe('normalizeHttpRootUrlWithSlash', () => {
  it('补 scheme、去尾斜杠再加根斜杠', () => {
    expect(normalizeHttpRootUrlWithSlash('')).toBe('');
    expect(normalizeHttpRootUrlWithSlash('  ')).toBe('');
    expect(normalizeHttpRootUrlWithSlash('app.example.com')).toBe('http://app.example.com/');
    expect(normalizeHttpRootUrlWithSlash('https://x/')).toBe('https://x/');
    expect(normalizeHttpRootUrlWithSlash('https://x///')).toBe('https://x/');
  });

  it('含 path 时保留 path 并规范末尾斜杠', () => {
    expect(normalizeHttpRootUrlWithSlash('https://api.example.com/v1')).toBe('https://api.example.com/v1/');
    expect(normalizeHttpRootUrlWithSlash('https://api.example.com/v1/')).toBe('https://api.example.com/v1/');
  });
});

describe('buildPm2StaticSiteRootUrl', () => {
  it('http://host:port/ 与非法端口', () => {
    expect(buildPm2StaticSiteRootUrl('', 3000)).toBe('');
    expect(buildPm2StaticSiteRootUrl('127.0.0.1', 0)).toBe('');
    expect(buildPm2StaticSiteRootUrl('127.0.0.1', 5173)).toBe('http://127.0.0.1:5173/');
    expect(buildPm2StaticSiteRootUrl('http://192.168.0.5', 8080)).toBe('http://192.168.0.5:8080/');
  });

  it('端口超 65535 或带路径输入时行为', () => {
    expect(buildPm2StaticSiteRootUrl('127.0.0.1', 65536)).toBe('');
    expect(buildPm2StaticSiteRootUrl('https://app.test/foo', 3000)).toBe('http://app.test:3000/');
  });
});
