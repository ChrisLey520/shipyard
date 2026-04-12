# 小程序（MP）原生导航、沉浸式与 TabBar 主题 — 问题与方案记录

| 项 | 内容 |
|----|------|
| 文档类型 | 工程备忘 / 问题与方案（非版本需求规格） |
| 范围 | `apps/mp` 微信小程序：顶栏、状态栏、窗口背景、TabBar、深浅色与主题色相 |
| 关联规划 | [shipyard-uni-app-mp-需求规格.md](../plans/shipyard-uni-app-mp-需求规格.md)、[shipyard-uni-app-mp-路线图.plan.md](../plans/shipyard-uni-app-mp-路线图.plan.md) |

---

## 1. 问题概览

### 1.1 沉浸式 / 顶栏、状态栏区域「一闪」或切页变色

**现象**：切换页面时，状态栏或导航区域先恢复 `pages.json` 默认浅色，再被应用主题色覆盖，产生闪烁。

**根因（摘要）**：

1. **原生导航栏**由微信先用 **`pages.json` / `globalStyle`** 绘制；JS 中的 `uni.setNavigationBarColor` 与页面内 Vue 渲染存在时序差，深色模式下首帧常为浅色配置。
2. **`page-meta` 必须是页面根节点第一个节点**；放在 `MpThemeProvider` 等子组件内可能无效或不稳定。
3. 仅给 `page-meta` 配窗口背景、**不配 `navigation-bar` 子节点**时，**导航条仍走静态配置**，与 `setNavigationBarColor` 叠加易产生多次跳变。
4. 在已用 `page-meta` 声明顶栏色的同时，**反复 `setNavigationBarColor` + 延迟重试**可能与原生切换页时的重绘打架，加重闪烁。

**方案**：

1. 全局使用 **`navigationStyle: custom`**（`pages.json` → `globalStyle`），**不再使用微信原生导航栏**，避免每页重绘默认顶栏；自绘 **`MpCustomNavBar`**（状态栏高度 + 胶囊对齐、主题色背景、Tab 页无返回等）。
2. 各页根上保留 **`page-meta`**（仅窗口/根背景等属性，**不含** `navigation-bar`），与主题 store 一致。
3. 小程序端 **`applyNativeChrome`** 不再调用 `setNavigationBarColor` / `setBackgroundColor`，仅 **`setStatusBarStyle`**（浅底 `dark` / 深底 `light`）+ TabBar 相关逻辑（见下节）。
4. **`MpCustomNavBar` 的 `z-index`** 不得高于 Wot 弹层：顶栏约 `500`，并在 `App.vue` 全局为 `.wd-overlay` / `.wd-popup` 提高 `z-index`（`!important`），避免个人设置等页的 ActionSheet、Popup 被挡。

**代码锚点**：

- `apps/mp/src/pages.json` — `globalStyle.navigationStyle: custom`
- `apps/mp/src/components/MpCustomNavBar.vue`
- `apps/mp/src/composables/useMpNavBarLayout.ts`
- `apps/mp/src/composables/useMpPageRootMeta.ts`
- `apps/mp/src/stores/theme.ts` — `applyNativeChrome`（小程序分支）
- `apps/mp/src/main.ts` — 注册 `MpCustomNavBar`、页面 `onShow` 同步 TabBar/状态栏
- `apps/mp/src/App.vue` — 弹层 z-index、小程序 `onLaunch` 延迟同步、`onShow` 补同步

#### 1.1.1 沉浸式 / 状态栏：排障过程与曾尝试手段（备忘）

「沉浸式」在此指 **状态栏 + 导航条区域与页面主题色一致、切页不闪回默认色**。实际排查中依次遇到下列问题，对应做法如下（**最终形态以本节开头「方案」为准**，下列为过程记录）。

| 阶段 | 问题 | 处理方式 |
|------|------|----------|
| 主题与系统 | `manifest.json` 中 **`mp-weixin.darkmode: true`** 时，微信按**系统**深浅切换原生壳，与应用内 **`colorMode`（auto/light/dark）** 及 `setNavigationBarColor` **打架** | **移除** `darkmode`，以 **Pinia + storage** 的 in-app 主题为准 |
| `page-meta` 位置 | 把 `page-meta` 放在 **`MpThemeProvider` 内部**：微信要求 **`page-meta` 为页面根 template 的第一个节点**，放在子组件里**不稳定或无效** | **每个页面**根上独立写 `<page-meta />`（先于 `mp-theme-provider`），逻辑收拢到 **`useMpPageRootMeta`** |
| `page-meta` 属性 | 在 `page-meta` 根上绑 **非法/无效** 的「导航栏」属性（与官方表不一致），顶栏仍走 `pages.json` | 按文档使用合法字段：`background-text-style`、`background-color`、`background-color-top`、**`root-background-color`**、**`background-color-bottom`** 等；需要控制**原生导航条**时用子节点 **`<navigation-bar>`**（`title`、`front-color` **仅 `#fff`/`#000`**、`background-color`、`color-animation-duration` 等） |
| 导航条与状态栏 | **只配 `page-meta` 窗口背景、不配 `navigation-bar`** 时，**导航条仍按 `pages.json` 浅色首帧绘制**，再被 API 改掉 → **一闪**；微信文档中 **`navigation-bar` 的 `front-color` 含状态栏前景色** | 在 `page-meta` 内增加 **`navigation-bar`**，标题与 `pages.json` 对齐（如 **`utils/mpPageNavTitles.ts`** 按 route 映射）；`onShow` 里刷新标题 revision，避免 Tab 切回标题不更新 |
| 与 API 叠加 | 全局 mixin **`onShow` / `onReady` + 多次 `setTimeout` 调用 `setNavigationBarColor` / `setBackgroundColor`**，与 **`page-meta` + 微信切页重绘** 叠加 → **先对一下又变回/多次闪** | **小程序端不再**用上述 API 驱动顶栏与窗口背景（避免与声明式配置**重复写色**）；仅保留 **`setStatusBarStyle`**（深底 `light` / 浅底 `dark`）及 TabBar 逻辑 |
| 仍不满足 | 只要仍存在 **微信原生导航栏**，切页时原生层仍可能 **先套用 `pages.json` 再被覆盖**，难以从根上消闪 | **`globalStyle.navigationStyle: custom`**，用 **`MpCustomNavBar`** 自绘顶栏区（`readMpNavBarLayout`：状态栏高度 + 与胶囊对齐的内容区高度，右侧预留胶囊宽度），主题色来自 **`darkPalette` + theme store** |

**补充**：早期还曾为 TabBar 在非 Tab 页调用 API 报错做过 **`isCurrentPageTabBar()`** 守卫（见 `utils/tabBarPages.ts`）；与「冷启动 TabBar 漏设」相关的内容见 **§1.4**。

---

### 1.2 个人设置等页「UI 不对」、弹层像被挡住

**现象**：操作菜单、修改密码弹窗异常（似被遮挡或点不到）。

**根因**：`MpCustomNavBar` 曾使用 **`z-index: 2000`**，而 Wot `wd-action-sheet` / `wd-popup` 默认内联 **`z-index: 10`**，弹层绘在顶栏下方。

**方案**：顶栏降至约 **`500`**；在 **`App.vue` 无 scoped 样式** 中为 `.wd-overlay`、`.wd-popup` 设置更高 **`z-index` + `!important`** 以压过内联样式。

---

### 1.3 深色模式下背景应随「主题色相」（fresh / ocean / violet）变化

**现象**：深色时全站背景与 Web 不一致或三套主题看起来一样。

**根因**：小程序侧写死如 `#0b1220`，未与 Web `apps/web/src/theme/themes.ts` 的深色 palette 对齐。

**方案**：新增 **`apps/mp/src/theme/darkPalette.ts`**，提供 `darkBodyBackground`、`darkHeaderBackground`、`darkTabBarBackground`、`darkCardBackground` 及登录/注册页用渐变配置；**`MpThemeProvider`、`MpCustomNavBar`、`useMpPageRootMeta`、theme store、Dashboard 卡片/图表** 等按 `themeId` + `isDark` 取用。登录/注册通过 **`useAuthDarkRoot`**（`variant: 'register'`）注入渐变与 `--auth-card-bg`。

**代码锚点**：

- `apps/mp/src/theme/darkPalette.ts`
- `apps/mp/src/theme/wotVars.ts` — 主色（与 Web 一致）
- `apps/mp/src/pages/workspace/dashboard.vue` — `--dash-card-bg`、`--dash-bar-fill`

---

### 1.4 冷启动时底部 TabBar 未随深色主题变色（页面内容已深色）

**现象**：首屏或刚进入 Tab 页时，**页面背景已是深色**，但 **原生 TabBar 仍为 `pages.json` 中的浅色默认值**，直到稍后才有几率被 `setTabBarStyle` 改掉。

**根因（摘要）**：

1. **原生 TabBar 与页面不同渲染管线**：首帧 TabBar 颜色来自 **`pages.json` 的 `tabBar`**，早于业务 JS；仅依赖 `setTabBarStyle` 必然晚于首帧。
2. **`App.onLaunch` → `hydrateFromStorage` → `applyNativeChrome`** 时，**`getCurrentPages()` 常仍为空**，若用 **`isCurrentPageTabBar()` 才调用 `setTabBarStyle`**，会 **跳过** 本次设置。
3. **`uni.setTabBarStyle` 在非 Tab 页失败**：用 `try/catch` 吞掉即可；小程序端改为 **不依赖 `isCurrentPageTabBar` 预判**，每次 `applyNativeChrome` **尽量调用**，失败忽略。

**方案**：

1. **运行时**：小程序端 **`applyNativeChrome` 内始终 `try { setTabBarStyle(...) }`**；**`App.vue`** 在 `onLaunch` 的 `hydrate` 之后 **`setTimeout(0)`、`150ms` 再调 `applyNativeChrome`**；**`onShow`**（小程序）再补一次，覆盖回前台。
2. **静态默认**：将 **`pages.json` 中 `tabBar` 默认样式改为「深色 + fresh」对齐**（如背景 `#0a1210`、文字 `#94a3b8`、`borderStyle: white`、选中色与 fresh 主色一致），使 **冷启动首帧** TabBar 即为深色；**浅色模式**仍由 **`setTabBarStyle`** 立即恢复浅底与边框。  
   - **代价**：浅色用户进入 Tab 页时，**理论上可能极短一帧**先看到深色 TabBar 再被改回浅色；若不能接受，需 **微信自定义 tabBar**（成本更高）。

**代码锚点**：

- `apps/mp/src/pages.json` — `tabBar` 默认值
- `apps/mp/src/stores/theme.ts` — `applyTabBarChrome`、`applyNativeChrome`（小程序 TabBar + 状态栏）
- `apps/mp/src/App.vue` — `onLaunch` 延迟同步、`onShow`
- `apps/mp/src/utils/tabBarPages.ts` — Tab 路由集合（非小程序路径仍可按需判断）

---

## 2. 已知限制与后续可选

| 项 | 说明 |
|----|------|
| 浅色首帧 TabBar | 当前以 **深色 biased 的 `pages.json` 默认** 换深色冷启动正确；浅色若需 **零误帧**，需 **自定义 tabBar**（`tabBar.custom: true` + `custom-tab-bar` 组件）。 |
| 主题色相与 JSON | `pages.json` 只能给 **一套** TabBar 默认色；**ocean / violet** 的底色与选中色仍依赖 **`setTabBarStyle`** 在首帧后修正，可能有极轻微色差帧。 |
| `setTabBarItem` 等 | 微信 **自定义 tabBar** 模式下部分 TabBar API 行为会变，若未来上自定义，需整体复查。 |

---

## 3. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-04-12 | 初稿：汇总沉浸式、弹层 z-index、darkPalette、TabBar 冷启动与 `pages.json` 默认策略。 |
| 2026-04-12 | 从 `.cursor/plans/` 迁至 `.cursor/notes/`，与版本规划文档分目录存放。 |
| 2026-04-12 | 增补 §1.1.1：沉浸式/状态栏排障过程（darkmode、page-meta 位置与属性、navigation-bar、API 与 custom 顶栏）。 |

（后续若改动策略，请在本表追加行并同步修改上文「方案」小节。）
