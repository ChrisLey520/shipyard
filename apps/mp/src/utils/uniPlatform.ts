/**
 * 运行端判断：勿用 import.meta.env.UNI_PLATFORM 顶层判断小程序，
 * vite 编译到微信时常被替换成空对象引用，导致恒为 false（进而误调 setTabBarStyle 等）。
 */
let cachedIsMp: boolean | null = null;

export function isUniMiniProgramRuntime(): boolean {
  if (cachedIsMp !== null) return cachedIsMp;
  try {
    const p = (uni.getSystemInfoSync() as { uniPlatform?: string }).uniPlatform;
    cachedIsMp = typeof p === 'string' && p.startsWith('mp-');
    return cachedIsMp;
  } catch {
    cachedIsMp = false;
    return false;
  }
}

/** 供监控等上报使用，如非小程序则回退 unknown */
export function readUniPlatformLabel(): string {
  try {
    const p = (uni.getSystemInfoSync() as { uniPlatform?: string }).uniPlatform;
    return typeof p === 'string' && p.length > 0 ? p : 'unknown';
  } catch {
    return 'unknown';
  }
}
