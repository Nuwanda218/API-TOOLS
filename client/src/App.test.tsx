import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders top-level modules and switches pages", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API接入" })).toBeInTheDocument();
    expect(screen.getByText("本地 API")).toBeInTheDocument();
    expect(screen.getByText("适配器注册表")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "用量检测" }));

    expect(screen.getByRole("heading", { name: "用量检测" })).toBeInTheDocument();
  });

  it("collapses the sidebar and switches between Chinese and English", async () => {
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "收起侧栏" }));

    expect(screen.getByTestId("app-shell")).toHaveClass("nav-collapsed");
    expect(screen.queryByText("API接入")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API接入" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Workbench" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Providers" })).toBeInTheDocument();
  });
});
