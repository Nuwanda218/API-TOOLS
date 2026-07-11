# API Tools 指令大全

项目工作目录：`F:\website\API Tools\.claude\worktrees\api-tools-v0-1-workbench`

---

## npm 脚本（根目录）

所有命令在项目根目录运行。

| 命令 | 说明 |
|------|------|
| `npm install` | 安装 server + client 全部依赖 |
| `npm run dev` | 一键启动：先启 server (8787)，等端口就绪后启 client (5173) |
| `npm run build` | 构建 server + client 到 dist |
| `npm run test` | 运行 server + client 全部测试 |
| `npm run typecheck` | TypeScript 类型检查 server + client |

---

## npm 脚本（单 workspace）

在根目录运行，用 `--workspace` 指定目标。

### server

| 命令 | 说明 |
|------|------|
| `npm run dev --workspace server` | 启动开发 server（tsx watch，热重载） |
| `npm run build --workspace server` | 编译 TypeScript → `server/dist/` |
| `npm run start --workspace server` | 以生产模式运行 server（需先 build） |
| `npm run test --workspace server` | 运行 server 测试（vitest） |
| `npm run typecheck --workspace server` | server TypeScript 类型检查 |

### client

| 命令 | 说明 |
|------|------|
| `npm run dev --workspace client` | 启动 Vite 开发 server（默认 5173） |
| `npm run build --workspace client` | 构建 React 前端 → `client/dist/` |
| `npm run test --workspace client` | 运行 client 测试（vitest + jsdom） |
| `npm run typecheck --workspace client` | client TypeScript 类型检查 |

---

## 手动分离启动

如果不想用 `npm run dev` 的并发启动，可以分两个终端：

```bash
# 终端 1：启动后端
npm run dev --workspace server
```

```bash
# 终端 2：等 server 就绪后启动前端
npm run dev --workspace client
```

---

## 端口管理

| 服务 | 默认端口 | 说明 |
|------|----------|------|
| Server (Express) | `8787` | 可通过 `.env` 中的 `PORT` 变量修改 |
| Client (Vite) | `5173` | 已在 `vite.config.ts` 中设置 `strictPort: true` |

### 端口被占用时

```bash
# 在 PowerShell 中（必须用 cmd 终端）：
netstat -ano | findstr "8787"
taskkill /PID <进程ID> /F

# 在 Git Bash 中：
netstat -ano | grep 8787
taskkill //PID <进程ID> //F
```

---

## 测试相关

### 运行全部测试

```bash
npm run test
```

### 运行单个 workspace 测试

```bash
npm run test --workspace server
npm run test --workspace client
```

### 运行单个测试文件

```bash
cd server && npx vitest run src/routes/usage.test.ts
cd client && npx vitest run src/pages/UsagePage.test.tsx
```

### watch 模式（开发时用）

```bash
cd server && npx vitest
cd client && npx vitest
```

---

## 类型检查

```bash
npm run typecheck
# 等价于：
npm run typecheck --workspace server && npm run typecheck --workspace client
```

---

## 构建

```bash
# 构建全部
npm run build

# 构建完成后，生产运行：
npm run start --workspace server
# 前端静态文件在 client/dist/，由 Vite 生产 server 或 nginx 托管
```

---

## Git 操作

```bash
# 查看当前分支状态
git status -u

# 查看最近提交
git log --oneline -10

# 查看 diff
git diff

# 提交
git add <files>
git commit -m "type: description"

# 推送到远程
git push

# 当前远程
# git@github.com:Nuwanda218/API-TOOLS.git (SSH)
# 分支: worktree-api-tools-v0-1-workbench
```

---

## 文件结构速查

```text
.
├─ server/
│  ├─ src/
│  │  ├─ index.ts            # 入口，启动 Express
│  │  ├─ app.ts              # Express 应用 + 路由注册
│  │  ├─ adapters/           # 各 API 格式适配器
│  │  ├─ apiProtocol/        # 统一调用协议
│  │  ├─ config/             # .env 读取
│  │  ├─ configuration/      # 配置导入导出
│  │  ├─ db/                 # SQLite client + schema
│  │  ├─ endpoints/          # HTTP endpoint CRUD + 测试
│  │  ├─ errors/             # ProviderError
│  │  ├─ mcp/                # MCP client + repository
│  │  ├─ providers/          # Provider/Model repository
│  │  ├─ routes/             # Express 路由
│  │  ├─ skills/             # Skill template + repository
│  │  ├─ test/               # 测试工具（in-memory DB）
│  │  ├─ usage/              # 用量统计 service
│  │  └─ workflows/          # 工作流 runner
│  ├─ dist/                  # 编译输出（.js）
│  └─ api-tools.db           # SQLite 数据库文件
│
├─ client/
│  ├─ src/
│  │  ├─ main.tsx            # React 入口
│  │  ├─ App.tsx             # 路由切换 + 布局
│  │  ├─ api/                # API client + types + errors
│  │  ├─ components/         # TopNav, NotificationProvider
│  │  ├─ pages/              # 12 个页面组件
│  │  ├─ test/               # 测试 setup
│  │  └─ styles.css          # 全局样式
│  ├─ dist/                  # 构建输出
│  └─ index.html             # HTML 入口
│
├─ docs/
│  ├─ superpowers/specs/     # 设计文档
│  ├─ superpowers/plans/     # 版本计划
│  └─ reference/             # 参考文档（本文件）
│
├─ .env                      # 环境变量（API Key 等）⚠ gitignore
├─ .env.example              # 环境变量模板
├─ tsconfig.base.json        # 公共 TS 配置
└─ package.json              # monorepo 根配置
```

---

## API 路由速查

所有路由前缀 `/api`。

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET/POST | `/api/providers` | Provider CRUD |
| GET | `/api/providers/:id/remote-models` | 拉取远程模型列表 |
| POST | `/api/providers/:id/import-models` | 导入远程模型 |
| POST | `/api/api-keys` | 保存 API Key 到 .env |
| GET/POST/PATCH/DELETE | `/api/models` / `/:id` | Model CRUD |
| POST | `/api/models/:id/test` | 测试模型 |
| GET/POST/PATCH/DELETE | `/api/endpoints` / `/:id` | Endpoint CRUD |
| POST | `/api/endpoints/:id/test` | 测试 HTTP endpoint |
| GET/POST/PATCH/DELETE | `/api/mcp-servers` / `/:id` | MCP Server CRUD |
| GET | `/api/mcp-servers/:id/tools` | 列出 MCP 工具 |
| POST | `/api/mcp-servers/:id/test` | 测试 MCP 连接 |
| GET | `/api/skills` | 列出 Skill 模板 |
| POST | `/api/skills/:id/run` | 运行 Skill |
| POST | `/api/workflows/run` | 运行 workflow |
| GET | `/api/runs` | 运行历史列表 |
| GET | `/api/runs/:id` | 单个 run 详情 + steps |
| GET | `/api/sessions` | 会话列表 |
| GET/POST/DELETE | `/api/sessions` / `/:id` | Session CRUD |
| GET | `/api/usage/summary` | 用量汇总 |
| GET | `/api/usage/dashboard` | 用量面板（支持 ?range&providerId&modelId） |
| GET | `/api/configuration/export` | 导出配置 |
| POST | `/api/configuration/import` | 导入配置 |

---

## 环境变量

`.env` 文件中的配置项：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8787` | Server 监听端口 |
| `DATABASE_PATH` | `./api-tools.db` | SQLite 数据库路径 |
| `OPENAI_API_KEY` | — | OpenAI API Key |
| `DEEPSEEK_API_KEY` | — | DeepSeek API Key |
| `CUSTOM_OPENAI_COMPATIBLE_KEY` | — | 通用兼容 API Key |
| `SHAREDCHAT_API_KEY` | — | SharedChat API Key |
| `TJU_API_KEY` | — | TJU API Key |
| `MCP_ALLOWED_COMMANDS` | `npx,node` | MCP 允许执行的命令，逗号分隔 |

---

## 首次启动完整验证

项目中已有用户指南（`docs/api-tools-v0-3-user-guide.md`），推荐验证命令：

```bash
npm run test --workspace server
npm run test --workspace client
npm run typecheck --workspace server
npm run typecheck --workspace client
npm run build --workspace server
npm run build --workspace client
```
