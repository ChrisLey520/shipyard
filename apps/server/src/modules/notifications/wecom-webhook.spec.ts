import { describe, expect, it } from 'vitest';

/** 与 NotifyWorkerApplicationService.sendWecom 的 markdown 载荷形状一致 */
function buildWecomMarkdownBody(text: string): { msgtype: string; markdown: { content: string } } {
  const content = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    msgtype: 'markdown',
    markdown: { content: `**Shipyard**\n${content}` },
  };
}

describe('企业微信 Webhook markdown', () => {
  it('转义尖括号并带标题前缀', () => {
    const body = buildWecomMarkdownBody('a <b> c');
    expect(body.msgtype).toBe('markdown');
    expect(body.markdown.content).toContain('&lt;');
    expect(body.markdown.content.startsWith('**Shipyard**')).toBe(true);
  });
});
