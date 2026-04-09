# Naive UI Theme（主题落地规范）

目标：把颜色/圆角/阴影/字体等“设计令牌（tokens）”统一落地到 Naive UI 的 theme overrides，**避免在页面里硬编码颜色**，从源头提升质感与一致性。

## 基本原则

- **只在一个入口配置主题**（推荐 `apps/web/src/App.vue`）
- **业务页面只用语义化 props**：`type="primary/success/warning/error/info"`、`size="small/medium/large"`、`secondary/tertiary/quaternary`、`bordered` 等
- **颜色使用语义**：成功/失败/进行中/待审批，不用“随便挑一个蓝色/红色”
- **布局用 UnoCSS**：主题只管“组件视觉”，页面布局/间距/排版用 UnoCSS（见 `FOUNDATIONS.md` / `PAGE-TEMPLATES.md`）

## 推荐主题参数（可直接抄）

> 说明：以下是“建议值”。你可以在实际页面视觉调优时微调，但不要在页面里散落颜色。

### Light / Dark 主题策略

- Light 模式：更白、更干净；Card 使用边框分层（少用阴影）
- Dark 模式：背景更深、对比更柔；边框弱化，依靠层级色差分层

### 主题 overrides 建议

在 `App.vue` 中通过 `NConfigProvider` 设置（示意）：

```ts
const themeOverrides = {
  common: {
    primaryColor: '#18a058',
    primaryColorHover: '#36ad6a',
    primaryColorPressed: '#0c7a43',

    successColor: '#18a058',
    warningColor: '#f0a020',
    errorColor: '#d03050',
    infoColor: '#2080f0',

    borderRadius: '8px',
    fontSize: '14px',
    fontSizeSmall: '12px',

    textColorBase: '#1f2328',
    textColor2: '#57606a',
    textColor3: '#6e7781',
  },
  Card: {
    borderRadius: '10px',
  },
  Button: {
    borderRadiusMedium: '8px',
    heightMedium: '36px',
  },
  DataTable: {
    borderRadius: '10px',
  },
} as const;
```

> 注意：`themeOverrides` 的字段会随 Naive UI 版本变化；以当前项目依赖版本的类型为准。

## 状态色映射（必须统一）

在页面用统一映射：

- `success`：成功
- `error`：失败
- `warning`：进行中 / 待审批
- `info`：部署中（或纯提示）
- `default`：队列中 / 未知

建议建立一个 `statusToTagType(status)` 的纯函数（可放在 `packages/shared` 的 utils 中，或放在 web 的 `src/utils/ui.ts`），避免每个页面各自映射。

## 与 UnoCSS 的边界

- Naive UI theme：定义“全局视觉语言”（颜色/圆角/字号/组件密度）
- UnoCSS：定义“页面结构与布局”（padding/margin/grid/flex/文本层级微调）
- 禁止：在页面里用手写 CSS/内联 style 去替代 theme 与 UnoCSS 的职责

## 字体与密度

- 列表/表格默认用 `size="small"`，但**筛选区、表单区**用 `default`，避免全站过密
- 页面标题使用 `NPageHeader`，不要自己拼 `<div>` 标题

