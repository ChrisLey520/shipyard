import { describe, expect, it } from 'vitest';
import { renderNotificationPlaceholders } from './notification-template';

describe('renderNotificationPlaceholders', () => {
  it('替换已知占位符', () => {
    expect(
      renderNotificationPlaceholders('项目 {{projectSlug}} 事件 {{event}}', {
        projectSlug: 'demo',
        event: 'BUILD_SUCCESS',
      }),
    ).toBe('项目 demo 事件 BUILD_SUCCESS');
  });

  it('缺省变量保留原文', () => {
    expect(renderNotificationPlaceholders('{{missing}} ok', { projectSlug: 'x' })).toBe('{{missing}} ok');
  });

  it('可嵌入系统默认文案 {{message}} / {{body}}', () => {
    expect(
      renderNotificationPlaceholders('[{{event}}] {{message}}', {
        event: 'BUILD_FAILED',
        message: '部署挂了',
        body: '部署挂了',
      }),
    ).toBe('[BUILD_FAILED] 部署挂了');
  });
});
