import { describe, expect, it } from "vitest";
import {
  CORE_OPERATION_SPECS,
  getCoreOperationSpec,
  isCoreOperation,
  isWorkflowExecutableOperation
} from "./operationCatalog.js";

describe("operation catalog", () => {
  it("declares the Phase 1 core operations", () => {
    expect(Object.keys(CORE_OPERATION_SPECS).sort()).toEqual([
      "http.request",
      "llm.chat",
      "models.list"
    ]);
  });

  it("marks implemented workflow operations as executable", () => {
    expect(getCoreOperationSpec("llm.chat")).toMatchObject({
      id: "llm.chat",
      status: "implemented",
      resourceKind: "model",
      workflowStep: true
    });
    expect(isWorkflowExecutableOperation("llm.chat")).toBe(true);
    expect(isWorkflowExecutableOperation("models.list")).toBe(false);
    expect(isWorkflowExecutableOperation("http.request")).toBe(true);
  });

  it("defines http.request for endpoint testing and workflow execution", () => {
    expect(getCoreOperationSpec("http.request")).toMatchObject({
      id: "http.request",
      status: "implemented",
      resourceKind: "endpoint",
      workflowStep: true
    });
  });

  it("recognizes core operation ids without accepting unknown ids", () => {
    expect(isCoreOperation("llm.chat")).toBe(true);
    expect(isCoreOperation("models.list")).toBe(true);
    expect(isCoreOperation("http.request")).toBe(true);
    expect(isCoreOperation("weather.current")).toBe(false);
    expect(getCoreOperationSpec("weather.current")).toBeUndefined();
  });
});
