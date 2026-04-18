import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MountSmoke from './MountSmoke.vue';

describe('Vue mount smoke', () => {
  it('mounts SFC with @vue/test-utils + happy-dom', () => {
    const w = mount(MountSmoke, { props: { msg: 'ok' } });
    expect(w.find('.mount-smoke').text()).toBe('ok');
  });
});
