import { describe, expect, it } from 'vitest';
import { BreadcrumbBuffer } from './breadcrumb.js';

describe('BreadcrumbBuffer', () => {
  it('evicts oldest when over max', () => {
    const b = new BreadcrumbBuffer(2, 100);
    b.add({ category: 'a', message: '1' });
    b.add({ category: 'b', message: '2' });
    b.add({ category: 'c', message: '3' });
    const s = b.snapshot();
    expect(s.map((x) => x.message).join(',')).toBe('2,3');
  });

  it('truncates large data', () => {
    const b = new BreadcrumbBuffer(5, 20);
    b.add({ category: 'x', message: 'm', data: { x: '012345678901234567890' } });
    const s = b.snapshot();
    expect(s[0]?.data).toMatchObject({ _truncated: true });
  });
});
