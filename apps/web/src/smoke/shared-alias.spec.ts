import { describe, expect, it } from 'vitest';
import { isValidUrlSlug } from '@shipyard/shared';

/** 校验 Vitest 与 Vite alias（@shipyard/shared）在 web 包可用 */
describe('web toolchain', () => {
  it('resolves @shipyard/shared', () => {
    expect(isValidUrlSlug('org-slug')).toBe(true);
    expect(isValidUrlSlug('Bad_Case')).toBe(false);
  });
});
