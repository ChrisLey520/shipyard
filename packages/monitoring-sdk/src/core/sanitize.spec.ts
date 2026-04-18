import { describe, expect, it } from 'vitest';
import { sanitizeValue, sanitizeUrl } from './sanitize.js';

describe('sanitizeValue', () => {
  it('redacts sensitive keys', () => {
    const out = sanitizeValue({ user: 'a', password: 'x', nested: { token: 't' } }, []) as Record<
      string,
      unknown
    >;
    expect(out['password']).toBe('[Redacted]');
    expect((out['nested'] as Record<string, unknown>)['token']).toBe('[Redacted]');
  });

  it('honors extra deny keys', () => {
    const out = sanitizeValue({ mySecret: 'v' }, ['mysecret']) as Record<string, unknown>;
    expect(out['mySecret']).toBe('[Redacted]');
  });
});

describe('sanitizeUrl', () => {
  it('strips query string', () => {
    expect(sanitizeUrl('https://a.com/p?q=1')).toBe('https://a.com/p');
  });
});
