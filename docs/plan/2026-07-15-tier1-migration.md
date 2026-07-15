# Tier 1 迁移计划 — 从文献计量学项目迁移通用基础设施

> 日期：2026-07-15
> 来源：`F:\26暑期实习\文献计量学论文主体部分\`
> 目标：`f:\website\API Tools\.claude\worktrees\api-tools-v0-1-workbench\`

---

## 背景

两个项目的 LLM 底层调用机制一致（零 SDK 依赖 + HTTP 直调 + 协议适配 + Provider 自动发现）。文献计量学项目有 15 项可迁移的通用模式，其中 Tier 1（高价值、低工作量）共 6 项。

完成后，本项目从"固定功能的 API 管理面板"升级为"可扩展的 API 编排平台"。

---

## 执行计划

### #1 存储/归档层 (`server/src/storage/`)

**来源**：`04_model_service/llm_gateway/storage.py`

- `jsonStore.ts` — `readJson<T>()` / `writeJson()` / `archiveJson()` / `nowIso()`
- `paths.ts` — 统一路径管理

能力：读写 JSON 自动创建父目录、写入前自动归档旧文件、统一路径管理

### #2 配置自动发现增强 (`server/src/config/`)

**来源**：`04_model_service/llm_gateway/config.py`

- 修改 `env.ts` — `discoverProviders()` 从 `.env` 自动扫描 Provider 配置

能力：`.env` 三行注册 Provider、协议自动推断、手动模型列表

### #3 Schema 定义统一 (`server/src/schemas/`)

**来源**：`04_model_service/llm_gateway/schemas.py`

- `results.ts` — `ProbeState` / `CapabilityResult` 等类型 + `toJSON()` / `fromJSON()`

能力：序列化契约统一、TypeScript interface + Zod 双保险

### #4 验证系统 (`server/src/validation/`)

**来源**：`03_task_agents/validate_section_json.py`

- `types.ts` — `ValidationIssue` / `ValidationResult`（blocking + advisory）
- `validator.ts` — `Validator<T>` 抽象类 + `runValidators()` 组合器
- `providerRules.ts` — Provider 配置校验
- `workflowRules.ts` — Workflow 步骤校验

能力：两级严重度、受控词汇表、可组合校验器

### #5 插件注册表 (`server/src/registry/`)

**来源**：`05_data_preprocessing/data_probe.py`

- `StepRegistry.ts` — `register()` / `execute()` / `catalog()`
- 修改 `workflows/runner.ts` 从 switch 改为注册表查找

能力：任意扩展 Workflow 步骤类型、自文档化、动态发现

### #6 知识库查询 (`server/src/knowledge/`)

**来源**：`03_task_agents/template_loader.py`

- `TemplateStore.ts` — 懒加载 + 层级查询 + 多条件过滤
- 修改 `skills/templateRegistry.ts` 从硬编码改为 TemplateStore

能力：可查询的分层模板库、端点预设、一键导入

---

## 预估

| # | 模块 | 代码行数 | 依赖 |
|---|------|---------|------|
| 1 | 存储/归档层 | ~80 TS + ~60 test | 无 |
| 2 | 配置自动发现 | ~100 TS + ~60 test | 无 |
| 3 | Schema 统一 | ~80 TS + ~50 test | #1 |
| 4 | 验证系统 | ~200 TS + ~100 test | #3 |
| 5 | 插件注册表 | ~180 TS + ~100 test | 无 |
| 6 | 知识库查询 | ~150 TS + ~80 test | #1 |
| **合计** | | **~1180 行** | |

每项一个 commit，全部完成后跑全量测试 + push。
