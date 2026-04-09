# Components（组件规范）

本文件规定“同类问题用同类组件解决”，减少 UI 变体，提升一致性与质感。

## 页面头部（Page Header）

- 必须使用 `NPageHeader`
- 结构：
  - `title`：页面主标题（短）
  - `subtitle`：辅助信息（repo、slug、说明等）
  - `#extra`：仅 1 个 Primary CTA + 若干次要操作（次要操作优先用 `secondary/tertiary`）

## 卡片（Card）

- 容器/区块统一用 `NCard`
- 列表页：优先用 Card + Table 的组合（筛选区 Card、列表区 Card）
- 详情页：Tabs + Card（每个 tab 内至少一个 Card）
- 卡片外层布局/间距/对齐：统一用 **UnoCSS**（例如 `mt-4`, `grid`, `gap-4`）

## 按钮层级（Button hierarchy）

- Primary（主操作）：每页最多 1 个（例如“创建项目 / 立即部署 / 保存”）
- Secondary（次操作）：`secondary` 或 `default`（例如“取消 / 返回 / 测试连接”）
- Dangerous（危险操作）：`type="error"`，必须二次确认（Modal 或 Popconfirm）

## 表格（DataTable）

- 默认：`size="small"`、开启行 hover
- 列规则：
  - 时间/耗时：统一格式化显示
  - 数字列右对齐
  - 状态列用 `NTag`，颜色通过统一映射函数获取
- 操作列：
  - 按钮用 `size="tiny"`，最多 2~3 个，更多放到 Dropdown

## 表单（Form）

- 使用 `NForm` + `NFormItem`
- label 规则：
  - 创建向导：`label-placement="top"`
  - 设置页：`label-placement="left"` + 固定 `label-width`
- 提交按钮：
  - 必须有 loading 状态
  - 成功 toast
  - 失败 toast（显示后端 message）

## Modal / Drawer

- 小表单：`NModal preset="card"`
- 复杂表单：`NDrawer`（分组清晰、可滚动）
- 关闭规则：
  - “取消”按钮 + 右上角关闭都可用
  - 正在提交时禁止关闭（或需要二次确认）

## 空状态 / 错误 / 加载

- 加载：优先 `NSpin` 包裹内容块，不要整页转圈
- 空状态：统一用 `NEmpty`
- 错误：优先 toast + 页面内保留可重试按钮

## 状态标签（StatusTag）

建议统一封装一个组件（可选）：

- 入参：`status: string`
- 输出：`NTag` + 统一文案 + 统一颜色映射

用于：部署状态、审批状态、任务状态等。

## UnoCSS 在组件层的用法

- 组件内部的布局（对齐、间距、分隔）优先用 UnoCSS 类名
- 不要用大量 `<style scoped>` 去“补 UI”，除非是 Naive UI 组件无法覆盖的极少数情况

