/** 用户主题偏好：与 Web `ThemeId` / `ColorMode`、Prisma User.themeId / colorMode 对齐 */

export const USER_THEME_IDS = ['fresh', 'ocean', 'violet'] as const;
export type UserThemeId = (typeof USER_THEME_IDS)[number];

export const USER_COLOR_MODES = ['auto', 'light', 'dark'] as const;
export type UserColorMode = (typeof USER_COLOR_MODES)[number];
