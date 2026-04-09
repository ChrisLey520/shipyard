# Page Templates（页面模板）

本文件提供可复用的页面骨架，避免每个页面从 0 开始拼 UI。

> 说明：页面骨架中的“布局与间距”统一用 **UnoCSS** 落地；Naive UI 负责组件与交互。

## 模板 A：列表页（List）

适用：项目列表、服务器列表、审批列表、成员列表

- Header：`NPageHeader`（标题 + #extra 主按钮）
- Filter 区：`NCard`（可选）
  - 搜索框、状态筛选、时间范围
- Content 区：`NCard`
  - `NDataTable`
  - `pagination`
- States：
  - loading：`NSpin`
  - empty：`NEmpty`

## 模板 B：详情页（Detail）

适用：项目详情、部署详情、环境详情

- Header：`NPageHeader`（title + subtitle + extra）
- Tabs：`NTabs`
- 每个 tab：
  - `NCard`（信息/列表/操作）
- Actions：
  - 主操作 1 个（例如“立即部署”）
  - 其他操作放在次按钮/Dropdown

## 模板 C：设置页（Settings）

适用：组织设置、项目设置、通知配置

- Header：`NPageHeader`
- 内容：
  - 分区 `NCard`（基础信息、危险操作）
  - 表单 `NForm label-placement="left"`
- 危险操作：
  - 单独 Card，按钮 `type="error"`，二次确认

## 模板 D：向导页（Wizard）

适用：新建项目

- Header：`NPageHeader`（带 back）
- 主容器：`NCard`
- 顶部：`NSteps`
- 内容区：
  - `NForm label-placement="top"`
  - 下一步/上一步：按钮位于底部右侧（或底部 `NSpace justify="end"`）

## 模板 E：日志/终端页（Logs）

适用：部署日志、构建日志

- Header：`NPageHeader`（状态 Tag 在 #extra）
- Meta：`NGrid` + `NStatistic`（环境、触发方式、耗时）
- Logs：`NCard` + Xterm 容器
  - 背景深色、圆角 8、内部 padding 8–12

### UnoCSS 快速骨架示例（片段）

```html
<div class="p-6">
  <div class="mb-4 flex items-center justify-between">
    <!-- NPageHeader -->
  </div>
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <!-- cards -->
  </div>
</div>
```

