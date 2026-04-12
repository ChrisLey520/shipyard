# @shipyard/monitoring-sdk

跨 Web 与 uni-app 的监控上报 SDK（core / web / uni 子路径导出）。

## 包体与 tree-shaking（小程序）

- **务必**只从 `@shipyard/monitoring-sdk/uni` 引用初始化与类型；不要引用 `@shipyard/monitoring-sdk/web`。
- `web` 入口会拉取 `web-vitals` 与浏览器专用逻辑；错误引用会导致小程序包体膨胀或构建失败。
- Core 无 `@dcloudio/*` 依赖；`uni` 适配器在运行时依赖全局 `uni`，与条件编译配合使用。

## 插件开发指南

插件用于在**不修改 SDK 源码**的前提下挂载自定义采集（如 `PerformanceObserver`、`healthcheck`、业务埋点）。上报仍走 `MonitoringClient` 的同一套管道：**脱敏、采样、队列、批量 ingest**。

### 适用场景

- Web 独有 API（如 `PerformanceObserver`、长任务）封装为插件；小程序侧用独立插件或条件编译，避免把 web-only 代码打进 MP。
- 业务域埋点：在 `setup` 里订阅路由/Store，调用 `ctx.capture('custom', …)`。

### 类型与导入

```ts
import type {
  MonitoringPlugin,
  MonitoringPluginContext,
  MonitoringPluginCleanup,
} from '@shipyard/monitoring-sdk/core';
```

`MonitoringPluginCleanup` 即 `() => void`，由 `setup` 可选返回。

### `MonitoringPluginContext`（插件可见能力）

| 成员 | 说明 |
|------|------|
| `capture(type, payload, options?)` | 与 `MonitoringClient.capture` 同语义；`options.force` 可绕过采样。 |
| `addBreadcrumb(entry)` | 与客户端面包屑一致；`error` 上报时会附带最近 N 条。 |
| `flush(useBeacon?)` | 将当前队列尝试发出（Web 侧可与 `keepalive` 配合）。 |
| `platform` | 字符串，如 `web` 或 `uni-mp-weixin`。 |
| `release` / `env` | 来自初始化配置的快照；可能为 `undefined`。 |

**不会暴露**：`ingestToken`、`endpoint`、完整 `MonitoringCoreConfig`，避免第三方插件窃取上报凭证。

### 生命周期与执行顺序

1. **`createMonitoringClient` / `initWebMonitoring` / `initUniMonitoring` 构造阶段**  
   按 `plugins` **数组顺序**依次调用 `plugin.setup(ctx)`（多个插件共享**同一份** `ctx`）。  
   `initWebMonitoring` 中：**插件先于**内置的 router 面包屑、全局错误、Vue `errorHandler`、web-vitals、axios 拦截器注册完成 setup。

2. **`shutdown()`**  
   - 停止定时 flush；  
   - 按与 `setup` **相反顺序**调用各插件返回的 cleanup（LIFO）；  
   - 再执行最后一次 `flush`；  
   - 最后标记 `closed`，此后 `capture` 无效。  

   teardown 过程中仍可 `capture`，事件会进入**最后一次** `flush`。

### 接入方式

**方式 A — Web：**

```ts
initWebMonitoring({
  // ...projectKey, endpoint, ingestToken, app, ...
  plugins: [myPlugin],
});
```

**方式 B — uni-app：**

```ts
initUniMonitoring({
  // ...
  plugins: [myPlugin],
});
```

**方式 C — 仅 core（测试或自定义 transport）：**

```ts
createMonitoringClient({
  // ...transport, getSessionId, ...
  plugins: [myPlugin],
});
```

### `capture` 约定

- **第一参 `type`**：须为 `MonitoringEventType` 字面量（如 `error`、`custom`、`resource_error`、`timing`、`healthcheck` 等）；定义见 [`src/core/types.ts`](src/core/types.ts)，与 Ingest 契约 [openapi/v1.yaml](../monitoring-contracts/openapi/v1.yaml) 对齐。
- **第二参 `payload`**：可序列化对象；敏感字段名会被默认脱敏规则及 `sensitiveKeys` 处理。
- **第三参**：`{ sample?: boolean; force?: boolean }`。重要错误建议 `{ force: true }` 以绕过全局 `sampleRate`。

### 约束与限制（当前版本）

- `setup` / teardown 均为**同步**；不支持返回 `Promise`。
- 不提供 `beforeCapture` 修改事件体（避免破坏脱敏与契约）。
- 不支持构造后再 `registerPlugin`；需通过配置传入 `plugins` 数组。

### 示例：`resource_error`（Web + PerformanceObserver）

需在支持 `PerformanceObserver` 的环境运行；启发式（`transferSize` / `decodedBodySize`）仅供参考，可按业务调整。

```ts
import type { MonitoringPlugin } from '@shipyard/monitoring-sdk/core';

export const resourceErrorPlugin: MonitoringPlugin = {
  name: 'resource-error',
  setup(ctx) {
    if (typeof PerformanceObserver === 'undefined') return;
    const obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.entryType !== 'resource') continue;
        const r = e as PerformanceResourceTiming;
        if (r.transferSize === 0 && r.decodedBodySize === 0) {
          ctx.capture(
            'resource_error',
            { name: r.name, initiatorType: r.initiatorType },
            { force: true },
          );
        }
      }
    });
    try {
      obs.observe({ type: 'resource', buffered: true });
    } catch {
      return;
    }
    return () => obs.disconnect();
  },
};

// initWebMonitoring({ ..., plugins: [resourceErrorPlugin] })
```

### 调试与单测

- 本包单测含插件 setup、teardown 逆序、经 `ctx.capture` 入队等用例，可参考 [`src/core/client.spec.ts`](src/core/client.spec.ts)。
- 本地：`pnpm --filter @shipyard/monitoring-sdk test`

## 测试

```bash
pnpm --filter @shipyard/monitoring-sdk test
```

单测覆盖：脱敏、面包屑环形缓冲、队列 flush、`transport` mock、`shouldSample`、采样与 `force`、`shutdown`、插件 setup/teardown 顺序。

## 契约

事件形态与 Ingest API 见 [packages/monitoring-contracts](../monitoring-contracts/openapi/v1.yaml)。
