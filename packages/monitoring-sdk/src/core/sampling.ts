/** 确定性采样：同 session 内稳定（可选）；此处用随机 */
export function shouldSample(rate: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return Math.random() < rate;
}
