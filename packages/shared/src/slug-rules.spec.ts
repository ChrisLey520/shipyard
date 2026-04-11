import { describe, expect, it } from 'vitest';
import { isValidUrlSlug, slugifyFromDisplayName } from './slug-rules';

describe('slug-rules', () => {
  it('isValidUrlSlug 接受合法路径段', () => {
    expect(isValidUrlSlug('abc')).toBe(true);
    expect(isValidUrlSlug('a-b-1')).toBe(true);
    expect(isValidUrlSlug('a'.repeat(64))).toBe(true);
  });

  it('isValidUrlSlug 拒绝空串、大写与非法字符', () => {
    expect(isValidUrlSlug('')).toBe(false);
    expect(isValidUrlSlug('  ')).toBe(false);
    expect(isValidUrlSlug('Ab')).toBe(false);
    expect(isValidUrlSlug('a_b')).toBe(false);
    expect(isValidUrlSlug('a'.repeat(65))).toBe(false);
  });

  it('slugifyFromDisplayName 小写并折叠非字母数字为连字符', () => {
    expect(slugifyFromDisplayName('Hello World')).toBe('hello-world');
    expect(slugifyFromDisplayName('Foo__Bar!!!')).toBe('foo-bar');
  });
});
