import {
  Activity,
  Cpu,
  FileJson,
  Globe2,
  Languages,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  PlugZap,
  ScrollText,
  Settings,
  SquareTerminal,
  Workflow,
  type LucideIcon
} from "lucide-react";

export type PageKey =
  | "dashboard"
  | "workbench"
  | "providers"
  | "models"
  | "endpoints"
  | "configuration"
  | "usage"
  | "runs"
  | "workflows"
  | "settings";
export type LanguageKey = "zh-CN" | "en";

interface NavGroup {
  label: Record<LanguageKey, string>;
  items: NavItem[];
}

interface NavItem {
  key: PageKey;
  labels: Record<LanguageKey, string>;
  Icon: LucideIcon;
}

const navGroups: NavGroup[] = [
  {
    label: { "zh-CN": "主要", en: "Main" },
    items: [
      { key: "dashboard", labels: { "zh-CN": "概览", en: "Dashboard" }, Icon: LayoutDashboard },
      { key: "workbench", labels: { "zh-CN": "工作台", en: "Workbench" }, Icon: SquareTerminal }
    ]
  },
  {
    label: { "zh-CN": "管理", en: "Management" },
    items: [
      { key: "providers", labels: { "zh-CN": "API接入", en: "Providers" }, Icon: PlugZap },
      { key: "models", labels: { "zh-CN": "模型管理", en: "Models" }, Icon: Cpu },
      { key: "endpoints", labels: { "zh-CN": "Endpoint", en: "Endpoints" }, Icon: Globe2 },
      { key: "configuration", labels: { "zh-CN": "配置迁移", en: "Configuration" }, Icon: FileJson }
    ]
  },
  {
    label: { "zh-CN": "监控", en: "Monitoring" },
    items: [
      { key: "usage", labels: { "zh-CN": "用量检测", en: "Usage" }, Icon: Activity },
      { key: "runs", labels: { "zh-CN": "运行历史", en: "Runs" }, Icon: ScrollText }
    ]
  },
  {
    label: { "zh-CN": "工具", en: "Tools" },
    items: [
      { key: "workflows", labels: { "zh-CN": "工作流模板", en: "Workflows" }, Icon: Workflow },
      { key: "settings", labels: { "zh-CN": "设置", en: "Settings" }, Icon: Settings }
    ]
  }
];

const shellCopy: Record<
  LanguageKey,
  {
    brandSubtitle: string;
    collapse: string;
    expand: string;
    language: string;
    navAria: string;
    protocol: string;
    genericApi: string;
    simplifiedChinese: string;
    english: string;
  }
> = {
  "zh-CN": {
    brandSubtitle: "工作台",
    collapse: "收起侧栏",
    expand: "展开侧栏",
    language: "语言",
    navAria: "主导航",
    protocol: "协议",
    genericApi: "通用 API",
    simplifiedChinese: "简体中文",
    english: "English"
  },
  en: {
    brandSubtitle: "Workbench",
    collapse: "Collapse sidebar",
    expand: "Expand sidebar",
    language: "Language",
    navAria: "Main navigation",
    protocol: "Protocol",
    genericApi: "Generic API",
    simplifiedChinese: "简体中文",
    english: "English"
  }
};

export function TopNav({
  collapsed,
  currentPage,
  language,
  onCollapsedChange,
  onLanguageChange,
  onPageChange
}: {
  collapsed: boolean;
  currentPage: PageKey;
  language: LanguageKey;
  onCollapsedChange: (collapsed: boolean) => void;
  onLanguageChange: (language: LanguageKey) => void;
  onPageChange: (page: PageKey) => void;
}) {
  const shell = shellCopy[language];
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside className={`side-nav ${collapsed ? "collapsed" : ""}`} aria-label="Workspace navigation">
      <div className="brand-block">
        <div className="brand-mark">AT</div>
        {!collapsed && (
          <div className="brand-copy">
            <div className="brand">API Tools</div>
            <span>{shell.brandSubtitle}</span>
          </div>
        )}
        <button
          aria-label={collapsed ? shell.expand : shell.collapse}
          aria-pressed={collapsed}
          className="nav-toggle"
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <ToggleIcon aria-hidden="true" size={18} strokeWidth={2.2} />
        </button>
      </div>

      <nav aria-label={shell.navAria}>
        {navGroups.map((group) => (
          <div key={group.label[language]} className="nav-group">
            {!collapsed && <span className="nav-group-label">{group.label[language]}</span>}
            {group.items.map((item) => {
              const label = item.labels[language];
              const Icon = item.Icon;
              const isActive = item.key === currentPage;

              return (
                <button
                  key={item.key}
                  aria-label={label}
                  className={isActive ? "active" : ""}
                  title={collapsed ? label : undefined}
                  type="button"
                  onClick={() => onPageChange(item.key)}
                >
                  <Icon aria-hidden="true" className="nav-icon" size={18} strokeWidth={2.1} />
                  {!collapsed && <span className="nav-label">{label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="side-footer">
        {!collapsed && (
          <div className="protocol-block">
            <span>{shell.protocol}</span>
            <strong>{shell.genericApi}</strong>
          </div>
        )}
        <div className="language-switch" aria-label={shell.language}>
          <Languages aria-hidden="true" className="language-icon" size={16} />
          <button
            aria-label={shell.simplifiedChinese}
            aria-pressed={language === "zh-CN"}
            className={language === "zh-CN" ? "active" : ""}
            type="button"
            onClick={() => onLanguageChange("zh-CN")}
          >
            {collapsed ? "中" : "简中"}
          </button>
          <button
            aria-label={shell.english}
            aria-pressed={language === "en"}
            className={language === "en" ? "active" : ""}
            type="button"
            onClick={() => onLanguageChange("en")}
          >
            EN
          </button>
        </div>
      </div>
    </aside>
  );
}
