/** 构建期注入，如 https://api.example.com/api */
export function getApiBase(): string {
  const v = import.meta.env.VITE_API_BASE as string | undefined;
  if (v && v.trim()) return v.replace(/\/$/, '');
  /* H5 开发可回落到同源代理；小程序须配置合法域名 */
  // #ifdef H5
  return '';
  // #endif
  // #ifndef H5
  return '';
  // #endif
}
