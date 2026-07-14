# CLAUDE.md

> 本文件定义 Claude Code 在本项目中必须遵守的规则。违反任何一条即为执行失败。

---

## 0. 执行权限

- **所有代码修改、文件写入、命令执行（包括测试脚本运行），必须先向用户说明理由，获得明确许可后再执行。**
- 每次操作前必须在对话中说明：做什么、影响哪些文件、为什么需要做。获得用户明确确认（"可以""好""执行""改吧""行"等）后再动手。
- 分析、阅读、搜索类操作（Read / Grep / Glob）无需确认。
- 用户沉默或转移话题时，不可自行执行。

---

## 1. 架构设计红线

### 1.1 禁止补丁式修复
- 任何问题必须追溯至架构根因给出系统性解决方案。
- 禁止头痛医头的局部修改、加 if-else 分支绕过问题、加 try-catch 吞掉异常。
- 如果一个问题在 3 处以上需要重复修复，说明根因未解决，必须回到架构层重新设计。

### 1.2 禁止兼容层 / 别名 / 适配过渡层
- 所有字段、模块、接口必须统一命名、统一职责，逻辑直白无冗余。
- 禁止出现 `old_field` / `new_field` 并存、`v1_` / `v2_` 前缀区分版本。
- 如需改名，全局搜索替换，不留别名。

### 1.3 禁止破坏分层边界
- 项目采用分层架构：
  - **client/** — React 前端，只通过 `/api` 与后端通信，禁止直调外部 API
  - **server/src/routes/** — Express 路由层，处理 HTTP 请求/响应
  - **server/src/workflows/** — 工作流编排层，组合 LLM 调用 + HTTP 调用 + MCP 调用
  - **server/src/adapters/** — 协议适配层，封装不同 LLM API 格式差异
  - **server/src/db/** — 数据持久化层（SQLite via sql.js）
- 上层只依赖下层，下层绝不反向引用上层。
- 禁止跨层调用、循环依赖、职责越界。
- **client 永远不直接调用外部 LLM API**，所有外部调用必须经过 server。

### 1.4 禁止重复功能实现
- 严格遵循单一职责原则。
- 同类逻辑统一收敛至单一模块：
  - 所有 LLM 调用走 `adapterRegistry.invoke()`（`adapters/registry.ts`）
  - 所有文件写入走 `server/src/config/dotenvFile.ts`
  - 所有数据库操作走对应的 Repository 模块
- 新增功能前先检查是否已有同类实现。

---

## 2. 类型安全红线

### 2.1 禁止无类型声明的跨模块函数
- 所有对外接口（exported function、class public method）必须明确输入参数类型与返回值类型。
- TypeScript strict mode 已开启（`tsconfig.base.json`），不可放宽。

### 2.2 禁止上下游接口类型不匹配
- 跨层边界处的输出类型必须与下一级输入类型严格对齐。
- 例如：`AdapterRegistry.invoke()` 返回的 `ApiInvocationOutcome` 必须与 `WorkflowRunner` 消费的字段完全一致。
- 修改接口时必须同步更新所有上下游。

### 2.3 禁止无容错的裸解析逻辑
- 所有外部输入反序列化必须走 Zod schema 验证，禁止裸 `JSON.parse` 后直接当类型使用。
- 所有数据库读取结果必须做字段存在性校验。
- 禁止 `as` 类型断言绕过类型检查（必要时用 Zod validate + type guard）。

### 2.4 禁止核心字段类型漂移
- 同一业务字段全链路命名、类型、结构必须完全统一。
- 例如：`modelId` 在所有层（routes → workflows → adapters → db）间传递时，必须保持相同的字段名和 `string` 类型。
- 禁止隐式类型转换（如 `number` → `string` → `number`）。

---

## 3. 代码与配置红线

### 3.1 禁止硬编码
- 所有可配置参数（端口、模型参数、路径、API 密钥引用）必须收敛至 `.env` 或数据库。
- **禁止在任何 TypeScript 代码中硬编码模型名（如 `model: "deepseek-v4-pro"`）或 Provider 名（如 `apiFormat: "openai-chat-completions"`）。所有模型/Provider 引用必须来自数据库记录或环境变量。**
- 至少包括：LLM 参数、路径常量、端口号、超时时间。

### 3.2 禁止留存无价值废代码
- 无业务意义、干扰判断、无复用价值的代码必须物理隔离迁移至 `_archive/` 目录。
- 仅保留有明确业务价值的代码。
- 未启用但有价值的代码需标注留存原因（注释格式：`// KEPT: <原因>`）。

### 3.3 禁止误导性注释、虚假实现
- 所有注释必须与代码逻辑完全一致（如 JSDoc `@returns {string}` 但实际返回 `Promise<number>` 即为违规）。
- 禁止 TODO 占位、空函数、硬编码假返回。
- 所有启用模块必须功能完整可用。

### 3.4 禁止静默吞错、裸抛通用异常
- 所有异常必须携带完整上下文信息（出错涉及的表/API/参数、原始错误消息）。
- 使用 `ProviderError`（21 种标准错误码）抛出业务异常，禁止 `throw new Error("something wrong")`。
- 错误信息格式：`"<模块>: <操作> 失败 — <上下文> — <原始错误>"`。
- catch 块必须要么处理错误（含日志），要么重新抛出；禁止空 catch。

---

## 4. 质量红线

### 4.1 禁止降低 API 工具标准
- 所有修改必须服务于核心目标：提供可靠、类型安全、可追溯的多 Provider API 管理能力。
- 禁止为简化实现而降低错误处理粒度或放弃调用追踪。

### 4.2 禁止破坏调用链路可追溯性
- 所有 LLM 调用必须记录完整链路：`session → run → run_steps`。
- 每个 run_step 必须包含：provider_id, model_id, input_tokens, output_tokens, latency_ms, cost_estimate。
- 禁止新增不经 run_steps 记录的 LLM 调用路径。

### 4.3 禁止绕过错误处理标准路径
- 所有外部 API 调用必须经过 adapter 层的错误映射（HTTP status → `ProviderErrorCode`）。
- 禁止新增直接 fetch 外部 API 而不经过 adapter 的路径。

### 4.4 禁止 API Key 泄露
- API Key 仅存在于 `.env` 文件，数据库只存环境变量名（`api_key_env` 字段）。
- 禁止在任何日志、错误消息、API 响应中输出 API Key 明文。
- 禁止将 API Key 写入数据库任何字段。

---

## 5. 操作规范

- 先分析，后提案，获得许可再执行。
- **计划/方案文件（plan）写入项目根目录 `docs/plan/` 下，不要写到项目外。在写入文件之前，必须先把方案内容展示给用户讨论确认，用户说"可以写入"后再 Write。**
- 每次修改后检查是否需要更新相关文档。
- 关键设计决策记录在 `docs/` 中。
- 测试脚本（仅用于诊断的临时文件）放入项目根目录，以 `test_` 前缀命名，诊断完成后归档或删除。

---

## 6. 项目工具速查

> 本项目为 TypeScript monorepo（npm workspaces），在 `.claude/worktrees/api-tools-v0-1-workbench/` 下开发。

### 6.1 环境前置

```powershell
# 所有命令在项目根目录（worktree 根）执行
cd "f:\website\API Tools\.claude\worktrees\api-tools-v0-1-workbench"

# 安装依赖
npm install
```

### 6.2 开发命令

```powershell
# 启动开发服务器（前后端同时）
npm run dev

# 仅启动后端（Express，端口 8787）
npm run dev:server

# 仅启动前端（Vite，端口 5173）
npm run dev:client

# 构建
npm run build

# 运行测试
npm test

# 类型检查
npm run typecheck
```

### 6.3 关键路径

| 路径 | 内容 |
|------|------|
| `.env` | API Key 配置（不提交 git） |
| `.env.example` | API Key 配置模板 |
| `api-tools.db` | SQLite 数据库文件 |
| `server/src/adapters/` | LLM API 协议适配器（OpenAI / Anthropic / Responses） |
| `server/src/workflows/runner.ts` | 工作流执行引擎 |
| `server/src/db/schema.ts` | 数据库表定义 |
| `server/src/errors/providerError.ts` | 21 种标准错误码 |
| `server/src/config/env.ts` | 环境变量加载与校验 |
| `client/src/App.tsx` | 前端路由入口 |

---

## 7. 代码审查规范

### 7.1 四类红线

**类型安全**：T-1 无类型声明禁止 / T-2 上下游类型不匹配禁止 / T-3 裸解析禁止 / T-4 字段类型漂移禁止

**代码配置**：C-1 硬编码禁止 / C-2 废代码残留禁止 / C-3 误导性注释禁止 / C-4 静默吞错禁止

**API 交互**：A-1 外部响应无校验禁止 / A-2 Token 用量无记录禁止 / A-3 模型参数散落禁止 / A-4 API Key 泄露禁止

**调用追溯**：E-1 调用链路断裂禁止 / E-2 错误码丢失禁止 / E-3 成本估算遗漏禁止

### 7.2 审查命令

```powershell
# 检查硬编码 URL / 模型名
rg -n "https://|deepseek|openai" -g "*.ts" server/src --glob "!**/config/**"

# 检查裸 JSON.parse
rg -n "JSON\.parse\(" -g "*.ts" server/src

# 检查空 catch
rg -n "catch\s*\([^)]*\)\s*\{\s*\}" -g "*.ts" server/src

# 检查 TODO / FIXME
rg -n "TODO|FIXME" -g "*.ts" .
```
