/** Slack Incoming Webhook 本身靠 URL 保密；可选 secret 映射为 Bearer，便于网关侧校验 */
export function buildSlackOptionalHeaders(secretPlain?: string): Record<string, string> | undefined {
  const s = typeof secretPlain === 'string' && secretPlain.trim() ? secretPlain.trim() : '';
  return s ? { Authorization: `Bearer ${s}` } : undefined;
}
