export type PageKey = "workbench" | "providers" | "models" | "usage" | "workflows" | "settings";

interface TopNavProps {
  currentPage: PageKey;
  onPageChange: (page: PageKey) => void;
}

const navItems: Array<{ key: PageKey; label: string }> = [
  { key: "workbench", label: "工作台" },
  { key: "providers", label: "API接入" },
  { key: "models", label: "模型管理" },
  { key: "usage", label: "用量检测" },
  { key: "workflows", label: "工作流模板" },
  { key: "settings", label: "设置" }
];

export function TopNav({ currentPage, onPageChange }: TopNavProps) {
  return (
    <header className="top-nav">
      <div className="brand">API Tools</div>
      <nav aria-label="主导航">
        {navItems.map((item) => (
          <button
            key={item.key}
            className={item.key === currentPage ? "active" : ""}
            type="button"
            onClick={() => onPageChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
