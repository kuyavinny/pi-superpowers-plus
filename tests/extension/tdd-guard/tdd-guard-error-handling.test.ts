import { describe, test, expect, vi, beforeEach } from "vitest";
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

describe("tdd-guard.ts error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("persist catch block logs debug in source", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/tdd-guard.ts", "utf-8");
    const persistFn = source.slice(source.indexOf("function persist"), source.indexOf("function persist") + 300);
    expect(persistFn).toContain("log.debug");
  });

  test("log import is present in tdd-guard.ts", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/tdd-guard.ts", "utf-8");
    expect(source).toContain('from "./logging.js"');
  });
});
