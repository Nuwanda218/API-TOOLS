import { useState } from "react";
import { TopNav, type PageKey } from "./components/TopNav";
import "./styles.css";

const pageCopy: Record<PageKey, { title: string; rows: Array<[string, string]> }> = {
  workbench: {
    title: "工作台",
    rows: [
      ["当前流程", "单步 llm.chat"],
      ["运行状态", "待执行"],
      ["输出区域", "未生成"]
    ]
  },
  providers: {
    title: "API接入",
    rows: [
      ["Provider", "0"],
      ["协议格式", "未选择"],
      ["连接状态", "未检测"]
    ]
  },
  models: {
    title: "模型管理",
    rows: [
      ["本地模型", "0"],
      ["默认能力", "chat"],
      ["启用状态", "待配置"]
    ]
  },
  usage: {
    title: "用量检测",
    rows: [
      ["请求数", "0"],
      ["输入 token", "0"],
      ["输出 token", "0"]
    ]
  },
  workflows: {
    title: "工作流模板",
    rows: [
      ["模板", "single-llm-chat"],
      ["步骤", "1"],
      ["状态", "可用"]
    ]
  },
  settings: {
    title: "设置",
    rows: [
      ["服务地址", "127.0.0.1:8787"],
      ["前端端口", "5173"],
      ["环境", "local"]
    ]
  }
};

function PlaceholderPage({ page }: { page: PageKey }) {
  const copy = pageCopy[page];

  return (
    <main className="page">
      <div className="page-header">
        <h1>{copy.title}</h1>
      </div>
      <section className="data-panel" aria-label={`${copy.title}概览`}>
        {copy.rows.map(([label, value]) => (
          <div className="data-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
    </main>
  );
}

export function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>("workbench");

  return (
    <div className="app-shell">
      <TopNav currentPage={currentPage} onPageChange={setCurrentPage} />
      <PlaceholderPage page={currentPage} />
    </div>
  );
}
