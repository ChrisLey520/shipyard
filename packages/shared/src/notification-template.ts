/**
 * 通知消息中的占位符，如 {{projectSlug}}、{{event}}；未知键保留原样
 */
export function renderNotificationPlaceholders(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, key: string) => {
    const v = vars[key];
    if (v === undefined || v === '') return full;
    return String(v);
  });
}
