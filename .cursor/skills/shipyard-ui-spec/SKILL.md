---
name: shipyard-ui-spec
description: 定义 Shipyard 管理后台的高品质 UI/UX 页面规范与落地流程（Vue 3 + Naive UI）。当用户提出“页面太丑/需要更美观/需要设计规范/统一风格/提升质感/重做 UI/组件规范/视觉规范”等诉求，或在实现新页面/重构现有页面样式时使用。输出应包含可执行的页面改造方案与一致的设计令牌（tokens）、组件规范、页面模板与验收清单。
---

# Shipyard UI 设计规范（Project Skill）

本 Skill 是**项目内**的页面规范，用于把 Shipyard 管理后台做成“干净、克制、有质感、信息密度合理、可长期扩展”的产品级界面。

## Quick Start（执行流程）

当需要实现或改造页面时，按以下步骤执行：

1. **识别页面类型**：列表页 / 详情页 / 表单页 / 仪表盘 / 空状态页 / 错误页 / 设置页
2. **建立信息架构**：主标题 + 次级信息 + 主操作（Primary CTA）+ 次操作（Secondary）
3. **套用页面模板**：参见 `PAGE-TEMPLATES.md`
4. **应用设计令牌**：色彩/圆角/阴影/间距/排版，参见 `FOUNDATIONS.md`
5. **组件一致性检查**：表格/表单/弹窗/按钮/标签/状态色，参见 `COMPONENTS.md`
6. **可用性与细节**：加载/错误/空状态、禁用态、提交态、确认提示，参见 `CHECKLIST.md`

## 设计原则（必须遵守）

- **一致性优先**：同一交互在全站用同一种组件与视觉语言（按钮层级、间距、标题等级、表格密度）
- **信息密度可控**：默认紧凑但不拥挤；关键数据用层级对比（字号/字重/色彩/留白）表达
- **强主操作**：每个页面只允许一个 Primary CTA（避免“全是主按钮”）
- **可读性**：正文对比度与行高要舒适；表格列对齐、数字右对齐；时间/状态可快速扫读
- **状态可视化**：构建/部署/审批用统一状态色与标签文案（成功/失败/进行中/待审批）
- **渐进披露**：高级配置折叠；危险操作单独分区并二次确认

## 技术落地约束（与项目栈对齐）

- **框架**：Vue 3 + Naive UI（优先使用 Naive UI 组件）
- **主题**：统一用 Naive UI theme overrides（见 `NAIVE-UI-THEME.md`），避免页面内硬编码颜色
- **接口层**：页面组件不直接写 `http.*` 调用；放到同目录 `api.ts`（已在项目中执行该规范）
- **样式（强制）**：UI 样式统一使用 **UnoCSS** 编写（utility-first）
  - 优先用 UnoCSS 的 **utilities + shortcuts** 表达间距/布局/排版/边框/圆角/阴影
  - 页面内尽量不写 `scoped CSS`；如必须写，需说明原因（例如第三方库样式覆盖、复杂动画）
  - tokens（间距/圆角/阴影/排版）应映射到 UnoCSS 约定，参见 `FOUNDATIONS.md`
  - Naive UI 组件的视觉（颜色/圆角/字体）仍由 `NAIVE-UI-THEME.md` 统一控制

## UnoCSS 使用规范（必须遵守）

- **禁止**：在页面中到处写行内 style（`style="..."`）来堆视觉
- **推荐**：
  - 布局：`flex`, `grid`, `items-center`, `justify-between`, `gap-4`, `p-6`
  - 排版：`text-sm`, `text-base`, `font-600`, `text-[var(--n-text-color-3)]`
  - 容器：`rounded-2`, `border`, `bg-[var(--n-color)]`
  - 交互：`hover:bg-...`, `transition`, `duration-200`
- **统一容器类**：建议用 shortcuts 定义 `page`, `card`, `section` 等通用容器（在项目接入 UnoCSS 后落地）

## 输出要求（你让我改 UI 时应产出什么）

每次 UI 改造/新增页面，输出至少包含：

- **页面目标**：一句话说明页面服务的任务
- **页面结构**：Header / Tabs / Filters / Table(or Cards) / Pagination / Drawer(or Modal)
- **关键状态**：loading / empty / error / success toast / confirm
- **组件选择**：为何用 DataTable / List / Steps / Form
- **对齐规范**：列出本次用到的 tokens（间距/字号/圆角/阴影）与状态色

## 参考资料

- 设计基础令牌：`FOUNDATIONS.md`
- Naive UI 主题与用法：`NAIVE-UI-THEME.md`
- 组件规范：`COMPONENTS.md`
- 页面模板：`PAGE-TEMPLATES.md`
- 验收清单：`CHECKLIST.md`

## 范围声明（重要）

- 本 Skill 只定义**管理后台 UI 规范与落地方式**，不替代业务需求评审。
- 如页面“丑/乱/密度不对”，优先按本 Skill 做**信息层级 + 组件一致性 + tokens** 三件事，再谈微调配色。

