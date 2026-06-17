import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkflowTemplatesPage } from "./WorkflowTemplatesPage";

describe("WorkflowTemplatesPage", () => {
  it("shows built-in workflow step templates", () => {
    render(<WorkflowTemplatesPage />);

    expect(screen.getByRole("heading", { name: "工作流模板" })).toBeInTheDocument();
    expect(screen.getByText("单步 LLM Chat")).toBeInTheDocument();
    expect(screen.getByText("llm.chat step")).toBeInTheDocument();
    expect(screen.getByText("HTTP Request 占位")).toBeInTheDocument();
  });
});
