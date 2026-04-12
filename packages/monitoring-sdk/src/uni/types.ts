/** 最小 uni 类型，避免 SDK 依赖 @dcloudio/* */
export interface UniRequestOptions {
  url: string;
  method?: string;
  header?: Record<string, string>;
  data?: string | Record<string, unknown>;
  success?: (res: { statusCode: number; data?: unknown }) => void;
  fail?: (err: unknown) => void;
}

export interface UniShim {
  request: (options: UniRequestOptions) => void;
  onError?: (cb: (msg: string) => void) => void;
  getSystemInfoSync?: () => { uniPlatform?: string; model?: string; system?: string };
}

export function getUni(): UniShim | undefined {
  if (typeof globalThis === 'undefined') return undefined;
  const g = globalThis as { uni?: UniShim };
  return g.uni;
}
