import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders top-level modules and switches pages", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "工作台" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API接入" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "用量检测" }));

    expect(screen.getByRole("heading", { name: "用量检测" })).toBeInTheDocument();
  });
});
