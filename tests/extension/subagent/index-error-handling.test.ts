import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock the logging module before importing the module under test
import * as logging from "../../../extensions/logging.js";

vi.mock("../../../extensions/logging.js", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof logging;
  return {
    ...actual,
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
});

describe("subagent/index error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("log import is present in subagent/index.ts source", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/subagent/index.ts", "utf-8");
    expect(source).toContain('from "../logging.js"');
  });

  test("JSON parse catch logs debug", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/subagent/index.ts", "utf-8");
    const jsonParseRegion = source.slice(
      source.indexOf("JSON.parse(line)"),
      source.indexOf("JSON.parse(line)") + 200,
    );
    expect(jsonParseRegion).toContain("log.debug");
  });

  test("finally cleanup catches log debug", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/subagent/index.ts", "utf-8");
    const finallyIndex = source.lastIndexOf("} finally {");
    const finallyRegion = source.slice(finallyIndex, finallyIndex + 400);
    expect(finallyRegion).toContain("log.debug");
  });
});
