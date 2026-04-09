# Foundations（设计基础令牌）

本文件定义 Shipyard 管理后台的基础视觉语言。实现时应同时映射到：

- Naive UI theme overrides（见 `NAIVE-UI-THEME.md`）
- **UnoCSS utilities / shortcuts**（页面布局与细节用 UnoCSS 落地）

## 色彩（Color）

目标：克制、清爽、强对比但不刺眼；状态色清晰；避免满屏彩色。

- **Brand 主色**：绿色系（沿用 Naive UI 的成功绿风格），用于主按钮、关键强调、图表主序列
- **背景层级**：
  - 页面背景：浅灰/白（暗色模式对应深灰）
  - 卡片背景：与页面背景有 1 级区分（边框或轻阴影）
  - 叠层（Modal/Drawer）：更强区分（遮罩 + 卡片）
- **文本层级**（从强到弱）：
  - Title：用于页面标题、Card 标题
  - Body：正文
  - Secondary：辅助信息（时间、说明）
  - Disabled：禁用态
- **状态色**：
  - Success：`success`
  - Warning：`warning`（进行中/待审批）
  - Error：`error`
  - Info：`info`（部署中/提示）

## 排版（Typography）

- **页面标题**：18–20px，600–700
- **区块标题**：16px，600
- **正文**：13–14px，400–500
- **辅助文本**：12–13px，400
- **数字/统计**：可用 20–28px，600（配合 NStatistic）

## 间距（Spacing）

统一采用 4 的倍数：

- XS：4
- S：8
- M：12
- L：16
- XL：24
- 2XL：32

页面推荐：

- 页面内边距：24
- Header 高度：56（已实现）
- Card 内边距：16（small 卡）/ 20（默认卡）
- 表单项间距：12–16

### UnoCSS 映射建议

建议在页面中用 UnoCSS 表达间距（示例）：

- `p-6`（≈ 24）用于页面内容区 padding
- `gap-4`（≈ 16）用于常见布局间距
- `mb-4/mt-4`（≈ 16）用于区块分隔

如果需要更强一致性，建议在 UnoCSS shortcuts 中定义：

- `page`: `p-6 max-w-[1200px] mx-auto`
- `section`: `mb-6`
- `card`: `rounded-2 border border-[var(--n-border-color)] bg-[var(--n-color)]`

## 圆角与边框（Radius & Border）

- **圆角**：8（默认），6（紧凑卡片/标签），10–12（大卡片）
- **边框**：1px，使用主题边框色；避免高饱和边框

## 阴影（Shadow）

只用于层级分离：

- Card：极轻阴影或仅边框（二选一）
- Modal/Drawer：中等阴影

## 动效（Motion）

- 过渡时长：150–220ms
- 仅对：Hover、Collapse、Drawer/Modal 进出场、Loading
- 避免花哨（不做大幅位移）

## CSS 变量使用建议（与 Naive UI 对齐）

在 UnoCSS 中可直接引用 Naive UI 变量（语义化）：

- 文本：`text-[var(--n-text-color)]`, `text-[var(--n-text-color-3)]`
- 边框：`border-[var(--n-border-color)]`
- 背景：`bg-[var(--n-color)]`（组件背景）

