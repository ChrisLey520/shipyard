import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetIcons,
} from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
  ],
  theme: {
    colors: {
      brand: {
        50: '#ecfdf5',
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b',
      },
    },
  },
  shortcuts: {
    'page': 'flex flex-col gap-4 min-w-0',
    'page-header': 'flex items-start justify-between gap-3',
    'page-title': 'text-[18px] leading-[24px] font-700',
    'page-subtitle': 'text-sm text-[var(--n-text-color-3)] mt-1',
    'card': 'rounded-3 border border-[var(--n-border-color)] bg-[var(--n-color)]',
    'card-section': 'p-5',
    'muted': 'text-[var(--n-text-color-3)]',

    // 主应用壳（整体背景氛围，参考登录页但更克制）
    'app-shell': 'relative min-h-[100dvh] bg-[var(--n-body-color)]',
    'app-bg': 'pointer-events-none absolute inset-0 overflow-hidden',
    'app-bg-grid': 'absolute inset-0 opacity-18 [background-image:linear-gradient(to_right,var(--app-grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--app-grid-line)_1px,transparent_1px)] [background-size:34px_34px] dark:opacity-12',
    'app-bg-blur-1': 'absolute -top-50 -left-60 w-[560px] h-[560px] rounded-full bg-[rgb(var(--app-accent-1)/0.08)] blur-3xl dark:bg-[rgb(var(--app-accent-1)/0.05)]',
    'app-bg-blur-2': 'absolute -bottom-65 -right-65 w-[760px] h-[760px] rounded-full bg-[rgb(var(--app-accent-2)/0.07)] blur-3xl dark:bg-[rgb(var(--app-accent-2)/0.05)]',

    // 认证页（登录/注册/找回密码）
    'auth-shell': 'relative min-h-[100dvh] overflow-hidden flex items-center justify-center px-4 py-0 bg-[var(--n-body-color)]',
    'auth-bg': 'pointer-events-none absolute inset-0',
    'auth-bg-grid': 'absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-25 dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)]',
    'auth-bg-blur-1': 'absolute -top-30 -left-30 w-[520px] h-[520px] rounded-full bg-brand-400/16 blur-3xl',
    'auth-bg-blur-2': 'absolute -bottom-40 -right-30 w-[640px] h-[640px] rounded-full bg-sky-400/10 blur-3xl',
    'auth-wrap': 'relative w-full max-w-[980px] grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch py-10',
    'auth-aside': 'hidden md:flex flex-col justify-between rounded-4 border border-[var(--n-border-color)] bg-[var(--n-card-color)] p-8',
    'auth-aside-title': 'text-[22px] leading-[28px] font-800',
    'auth-aside-list': 'mt-5 flex flex-col gap-3 text-sm text-[var(--n-text-color-2)]',
    'auth-card-wrap': 'w-full rounded-5 p-[1px] bg-[var(--n-border-color)]',
    'auth-card': 'w-full rounded-5 border border-transparent bg-[var(--n-card-color)] overflow-hidden shadow-[0_16px_55px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_55px_rgba(0,0,0,0.40)]',
    'auth-card-body': 'p-6',
    'auth-brand': 'flex items-center gap-2 text-[18px] leading-[24px] font-800',
    'auth-brand-mark': 'inline-flex items-center justify-center w-9 h-9 rounded-3 bg-brand-600 text-white',
    'auth-muted-link': 'text-[13px] text-[var(--n-text-color-3)] no-underline transition-colors hover:text-brand-700 dark:hover:text-brand-300 hover:underline underline-offset-4',
  },
});

