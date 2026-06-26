import { useState } from "react";
import { apiClient } from "./api/client";
import { NotificationProvider } from "./components/notifications/NotificationProvider";
import { TopNav, type LanguageKey, type PageKey } from "./components/TopNav";
import { ConfigurationPage } from "./pages/ConfigurationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EndpointsPage } from "./pages/EndpointsPage";
import { McpServersPage } from "./pages/McpServersPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ProvidersPage } from "./pages/ProvidersPage";
import { RunsPage } from "./pages/RunsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsagePage } from "./pages/UsagePage";
import { WorkbenchPage } from "./pages/WorkbenchPage";
import { WorkflowTemplatesPage } from "./pages/WorkflowTemplatesPage";
import "./styles.css";

export function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageKey>("dashboard");
  const [language, setLanguage] = useState<LanguageKey>("zh-CN");

  const content = (() => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage api={apiClient} language={language} />;
      case "workbench":
        return <WorkbenchPage api={apiClient} language={language} />;
      case "providers":
        return <ProvidersPage api={apiClient} language={language} />;
      case "models":
        return <ModelsPage api={apiClient} language={language} />;
      case "endpoints":
        return <EndpointsPage api={apiClient} language={language} />;
      case "mcpServers":
        return <McpServersPage api={apiClient} language={language} />;
      case "configuration":
        return <ConfigurationPage api={apiClient} language={language} />;
      case "usage":
        return <UsagePage api={apiClient} language={language} />;
      case "runs":
        return <RunsPage api={apiClient} language={language} />;
      case "workflows":
        return <WorkflowTemplatesPage api={apiClient} language={language} />;
      case "settings":
        return <SettingsPage language={language} />;
      default:
        return null;
    }
  })();

  return (
    <NotificationProvider>
      <div className={`app-shell console-shell ${collapsed ? "nav-collapsed" : ""}`} data-testid="app-shell">
        <TopNav
          collapsed={collapsed}
          currentPage={currentPage}
          language={language}
          onCollapsedChange={setCollapsed}
          onLanguageChange={setLanguage}
          onPageChange={setCurrentPage}
        />
        <div className="content-shell">{content}</div>
      </div>
    </NotificationProvider>
  );
}
