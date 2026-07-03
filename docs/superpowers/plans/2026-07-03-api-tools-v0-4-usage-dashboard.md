# API Tools V0.4 计划 — 用量检测增强

## Context

V0.3 已经把 API Tools 推进到可用的本地 API 编排工作台：Provider/Model/Endpoint/MCP Server 管理、Skill 模板、Workflow Builder、Run History、工作台三栏和 session 持久化均已具备。下一阶段 V0.4 建议聚焦 **用量检测增强**，把当前仅有全局汇总数字的 UsagePage，升级为可筛选、可分组、可追踪成本变化的用量分析面板。

本计划借鉴 cc-switch 的 Usage Dashboard 展示方式，但按 API Tools 的本地轻量定位做简化：

- 顶部全局筛选栏：时间范围 / Provider / Model
- Hero/KPI 汇总卡片：请求数、Tokens、成本、错误率、平均延迟
- 趋势区域：按天聚合的 CSS 柱状图，不引入图表库
- 分组统计 Tabs：按 Provider / 按 Model 汇总
- 请求明细列表：最近 run_step 明细，方便追踪成本来源

由于 dataviz 规则要求监控 dashboard 的筛选统一作用于下方所有组件，本版本采用“一个筛选栏作用全页面”的布局。

---

## 当前代码状态

### 后端现状

- `server/src/usage/usageService.ts` 当前只有 `getSummary()`：
  - 从 `runs` 表聚合：requestCount、inputTokens、outputTokens、estimatedCost、errorCount
  - 没有时间范围筛选
  - 没有 provider/model 分组
  - 没有趋势数据
  - 没有明细列表接口

- `server/src/routes/usage.ts` 当前只有：
  - `GET /api/usage/summary`

- 数据基础已经足够：
  - `runs`：status、started_at、ended_at、total_input_tokens、total_output_tokens、total_cost_estimate
  - `run_steps`：provider_id、model_id、latency_ms、input_tokens、output_tokens、cost_estimate、error_code、created_at
  - `providers` / `models`：可 join 出名称

### 前端现状

- `client/src/pages/UsagePage.tsx` 当前只有：
  - 一个 `getUsageSummary()` 请求
  - metric-grid 展示请求数、input/output tokens、错误数
  - 一个成本 row

- `client/src/api/types.ts` 只有 `UsageSummary`
- `client/src/api/client.ts` 只有 `getUsageSummary()`

---

## V0.4 目标范围

### 1. 全局筛选栏

新增筛选状态：

```ts
type UsageRange = "today" | "7d" | "30d" | "all";

interface UsageFilters {
  range: UsageRange;
  providerId?: string;
  modelId?: string;
}
```

筛选栏位置：UsagePage 顶部，page heading 下方，作用于下方所有数据。

筛选控件：

- 时间范围按钮：今日 / 7天 / 30天 / 全部
- Provider 下拉：全部 Provider / 每个 provider
- Model 下拉：全部 Model / 当前 provider 下的 models（如果选择了 provider）

不做自定义日期选择器，避免 V0.4 过重。

---

### 2. 后端 Usage Service 扩展

扩展 `server/src/usage/usageService.ts`，保留现有 `getSummary()`，新增以下方法：

```ts
getDashboard(filters: UsageFilters): UsageDashboard
getGroupedByProvider(filters: UsageFilters): UsageGroupRow[]
getGroupedByModel(filters: UsageFilters): UsageGroupRow[]
getDailyTrend(filters: UsageFilters): UsageTrendPoint[]
getRecentSteps(filters: UsageFilters): UsageStepRow[]
```

也可以先实现一个 `getDashboard(filters)`，内部返回所有数据，减少前端多次请求。

推荐接口：

```http
GET /api/usage/dashboard?range=7d&providerId=...&modelId=...
```

返回：

```ts
interface UsageDashboard {
  summary: UsageSummary;
  filters: {
    range: UsageRange;
    providerId?: string;
    modelId?: string;
  };
  byProvider: UsageGroupRow[];
  byModel: UsageGroupRow[];
  trend: UsageTrendPoint[];
  recentSteps: UsageStepRow[];
}
```

分组行：

```ts
interface UsageGroupRow {
  id: string | null;
  name: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  errorCount: number;
  averageLatencyMs: number | null;
}
```

趋势点：

```ts
interface UsageTrendPoint {
  date: string; // YYYY-MM-DD
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
  averageLatencyMs: number | null;
}
```

明细行：

```ts
interface UsageStepRow {
  id: string;
  runId: string;
  createdAt: string;
  status: "running" | "succeeded" | "failed";
  stepType: string;
  providerName: string | null;
  modelName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimate: number | null;
  latencyMs: number | null;
  errorCode: string | null;
}
```

---

### 3. SQL 设计

采用 **实时聚合，不新建 usage 汇总表**。

理由：

- 当前是本地个人工具，数据量可控
- 已有 `runs/run_steps` 足以实时 join 聚合
- 避免引入预聚合一致性问题
- 后续如果数据量增长，再加 daily rollup 表

过滤条件统一基于 `run_steps.created_at`：

```sql
where (@fromDate is null or run_steps.created_at >= @fromDate)
  and (@providerId is null or run_steps.provider_id = @providerId)
  and (@modelId is null or run_steps.model_id = @modelId)
```

Range 转换：

- `today`: 当天 00:00:00 至今
- `7d`: 最近 7 天
- `30d`: 最近 30 天
- `all`: 不加时间条件

Provider/Model 分组使用 left join：

```sql
from run_steps
left join providers on providers.id = run_steps.provider_id
left join models on models.id = run_steps.model_id
```

注意：`endpoint.call` / `mcp.call` 可能没有 model_id，Provider/Model 维度需要允许 `null`，显示为 `Unknown` / `No model`。

---

### 4. 前端类型与 API Client

`client/src/api/types.ts` 新增：

- `UsageRange`
- `UsageFilters`
- `UsageDashboard`
- `UsageGroupRow`
- `UsageTrendPoint`
- `UsageStepRow`

`client/src/api/client.ts` 新增：

```ts
getUsageDashboard(filters: UsageFilters) {
  const params = new URLSearchParams();
  params.set("range", filters.range);
  if (filters.providerId) params.set("providerId", filters.providerId);
  if (filters.modelId) params.set("modelId", filters.modelId);
  return requestJson<UsageDashboard>(`/api/usage/dashboard?${params}`);
}
```

UsagePage 还需要 provider/model 下拉数据，因此 props 需要从：

```ts
api: Pick<ApiClient, "getUsageSummary">
```

扩展为：

```ts
api: Pick<ApiClient, "getUsageDashboard" | "listProviders" | "listModels">
```

---

### 5. UsagePage UI 重构

文件：`client/src/pages/UsagePage.tsx`

布局顺序：

1. Page heading
2. 全局筛选栏
3. KPI summary row
4. 趋势图卡片
5. Stats tabs（Provider / Model）
6. Recent request/step list

#### 5.1 全局筛选栏

普通 HTML 控件，不引入 UI 库：

- 时间按钮组
- Provider select
- Model select
- loading 时保留旧数据但降低透明度（dataviz interaction 建议：refetch keeps frame）

#### 5.2 KPI Summary Row

基于 dataviz form rules：这是“handful of headline numbers”，用 stat tiles，不画图。

卡片：

- Requests
- Tokens（input + output）
- Estimated Cost
- Error Rate
- Avg Latency

Error Rate 计算：

```ts
errorRate = requestCount > 0 ? errorCount / requestCount : 0
```

Avg Latency 从后端 summary 返回，建议扩展 `UsageSummary`：

```ts
averageLatencyMs: number | null;
```

#### 5.3 趋势图

不引入 chart 库，使用 CSS columns/bars：

- 默认展示 `estimatedCost` 按天柱状
- 每个 bar 高度 = value / maxValue
- hover/focus tooltip 显示：日期、请求数、tokens、成本、错误数、平均延迟
- 下方附表格 fallback，满足可访问性

符合 dataviz 规则：

- 单序列 magnitude → sequential one hue
- bar ≤ 24px thick，4px rounded data-end
- tooltip 不作为唯一访问途径，表格也展示值

#### 5.4 分组统计 Tabs

两个 tab：

- Provider
- Model

每个 tab 展示表格：

| 名称 | 请求数 | Tokens | 成本 | 错误 | 平均延迟 |

不做多色图，避免 categorical 过多；表格更适合超过 7 个 provider/model 的场景。

#### 5.5 Recent Steps

展示最近 30 条 run_steps：

| 时间 | 类型 | Provider | Model | Tokens | Latency | Cost | Status |

点击行可链接到 Run History（如果当前已有 hash/router 后续可完善；V0.4 初版可显示 runId）。

---

### 6. 样式设计

文件：`client/src/styles.css`

新增类：

- `.usage-filter-bar`
- `.usage-range-tabs`
- `.usage-trend-card`
- `.usage-bar-chart`
- `.usage-bar`
- `.usage-stats-tabs`
- `.usage-table`
- `.usage-step-list`

颜色策略：

- 不新增复杂 palette
- 趋势柱状使用现有品牌绿 `#2eac8c`
- grid / borders 使用现有灰阶
- error/status 继续使用已有 warn/good tone

---

### 7. 测试计划

#### 后端测试

新增/扩展：`server/src/routes/usage.test.ts`

测试：

1. `GET /api/usage/dashboard` 返回 summary/byProvider/byModel/trend/recentSteps
2. range=7d 会排除更旧数据
3. providerId/modelId 筛选生效
4. failed step 计入 errorCount
5. endpoint/mcp step 没有 model 时仍能出现在统计中

#### 前端测试

扩展：`client/src/pages/UsagePage.test.tsx`（如当前没有则新建）

测试：

1. 渲染 KPI summary
2. 切换时间范围会调用 getUsageDashboard(range)
3. Provider 下拉筛选会刷新 dashboard
4. Provider/Model tab 切换显示不同表格
5. recent step rows 显示 cost/tokens/latency

#### 验证命令

```bash
npm run typecheck
npm run test
npm run build
```

---

## 实施顺序

1. 后端 UsageService + `/api/usage/dashboard`
2. 后端 usage route tests
3. 前端 types/client API
4. UsagePage UI 重构
5. UsagePage tests
6. typecheck/test/build
7. 更新 `docs/api-tools-v0-3-user-guide.md` 或新增 `docs/api-tools-v0-4-plan.md`（如果需要）

---

## 非目标（V0.4 暂不做）

- 不引入 ECharts/Recharts/Chart.js
- 不做自定义日期选择器
- 不做预聚合 daily rollup 表
- 不做 cache token 单独计费（当前 adapters 尚未统一解析 cache usage）
- 不做 quota/balance 查询
- 不做 cc-switch 那种跨 app brand icon filter，因为 API Tools 当前不是多 app 代理

---

## V0.4 完成判定

1. Usage 页面可按时间范围、Provider、Model 过滤
2. KPI 数字、趋势柱状图、分组表格、recent steps 明细全部跟随筛选联动
3. 成本估算来自 run_steps.cost_estimate / runs.total_cost_estimate，和 Run History 中展示一致
4. 页面不依赖第三方图表库，移动端降级为单列布局
5. 所有测试、typecheck、build 通过
