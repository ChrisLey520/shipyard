import { ServerOs } from './enums';

const SERVER_OS_SET = new Set<string>(Object.values(ServerOs));

/** 是否为合法的 ServerOs 枚举值（供 API / 表单校验） */
export function isServerOs(v: string): v is ServerOs {
  return SERVER_OS_SET.has(v);
}

/** 下拉与表格展示用文案 */
export const SERVER_OS_LABELS: Record<ServerOs, string> = {
  [ServerOs.LINUX]: 'Linux',
  [ServerOs.WINDOWS]: 'Windows',
  [ServerOs.MACOS]: 'macOS',
  [ServerOs.OTHER]: '其他',
};

/** 未知或历史值时回退为原字符串，避免界面空白 */
export function serverOsLabel(os: string): string {
  if (isServerOs(os)) return SERVER_OS_LABELS[os];
  return os || SERVER_OS_LABELS[ServerOs.LINUX];
}
