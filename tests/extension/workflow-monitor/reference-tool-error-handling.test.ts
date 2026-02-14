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

import { loadReference } from "../../../extensions/workflow-monitor/reference-tool.js";

describe("reference-tool.ts error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("catch block has log.warn in source", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/workflow-monitor/reference-tool.ts", "utf-8");
    const catchRegion = source.slice(source.indexOf("} catch"), source.indexOf("} catch") + 200);
    expect(catchRegion).toContain("log.warn");
  });

  test("log import is present", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("extensions/workflow-monitor/reference-tool.ts", "utf-8");
    expect(source).toContain('from "../logging.js"');
  });

  test("returns error string when topic is unknown", async () => {
    const result = await loadReference("nonexistent-topic");
    expect(result).toContain("Unknown topic");
    expect(result).toContain("nonexistent-topic");
  });
});
