import { describe, expect, it } from "vitest";
import { updateDotenvContent } from "./dotenvFile.js";

describe("dotenv file helpers", () => {
  it("inserts a new key into empty content", () => {
    expect(updateDotenvContent("", "DEEPSEEK_API_KEY", "sk-test")).toBe("DEEPSEEK_API_KEY=sk-test\n");
  });

  it("updates an existing key", () => {
    expect(updateDotenvContent("DEEPSEEK_API_KEY=old\n", "DEEPSEEK_API_KEY", "new")).toBe("DEEPSEEK_API_KEY=new\n");
  });

  it("preserves unrelated lines when inserting", () => {
    expect(updateDotenvContent("OPENAI_API_KEY=abc\n", "DEEPSEEK_API_KEY", "sk-test")).toBe(
      "OPENAI_API_KEY=abc\nDEEPSEEK_API_KEY=sk-test\n"
    );
  });

  it("quotes values that contain spaces", () => {
    expect(updateDotenvContent("", "CUSTOM_API_KEY", "value with space")).toBe('CUSTOM_API_KEY="value with space"\n');
  });

  it("trims accidental leading and trailing spaces before saving values", () => {
    expect(updateDotenvContent("", "TJU_API_KEY", " sk-test ")).toBe("TJU_API_KEY=sk-test\n");
  });

  it("quotes only when required and escapes quotes", () => {
    expect(updateDotenvContent("", "PLAIN_API_KEY", "sk-test-value")).toBe("PLAIN_API_KEY=sk-test-value\n");
    expect(updateDotenvContent("", "QUOTED_API_KEY", 'value "with" hash#')).toBe(
      'QUOTED_API_KEY="value \\"with\\" hash#"\n'
    );
  });
});
