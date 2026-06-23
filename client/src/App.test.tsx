import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders top-level modules and switches pages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    render(<App />);

    expect(screen.getByTestId("app-shell")).toHaveClass("console-shell");
    expect(screen.getByLabelText("Workspace navigation")).toBeInTheDocument();
    expect(screen.getByText("API operations console")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API接入" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "运行历史" })).toBeInTheDocument();
    expect(screen.getByText("单步工作流")).toBeInTheDocument();
    expect(screen.getByLabelText("消息")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "用量检测" }));

    expect(screen.getByRole("heading", { name: "用量检测" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "运行历史" }));

    expect(screen.getByRole("heading", { name: "运行历史" })).toBeInTheDocument();
  });

  it("collapses the sidebar and switches between Chinese and English", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "收起侧栏" }));

    expect(screen.getByTestId("app-shell")).toHaveClass("nav-collapsed");
    expect(screen.queryByText("API接入")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API接入" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Workbench" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Providers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Runs" })).toBeInTheDocument();
  });
});
