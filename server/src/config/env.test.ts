import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findLocalEnvPath } from "./env.js";

let tempDirectory: string | undefined;

afterEach(async () => {
  if (tempDirectory) {
    await rm(tempDirectory, { recursive: true, force: true });
    tempDirectory = undefined;
  }
});

describe("env config", () => {
  it("finds a parent .env when started from a workspace package", async () => {
    tempDirectory = join(tmpdir(), `api-tools-env-${Date.now()}`);
    const serverDirectory = join(tempDirectory, "server");

    await mkdir(serverDirectory, { recursive: true });
    await writeFile(join(tempDirectory, ".env"), "OPENAI_API_KEY=sk-test\n");

    expect(findLocalEnvPath(serverDirectory)).toBe(join(tempDirectory, ".env"));
  });
});
