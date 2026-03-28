import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  appendTelemetryRecord,
  buildTelemetryRecord,
  getTelemetryFilePath,
} from "../../../extensions/subagent/telemetry";

const roots = new Set<string>();

function createTempCwd() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi-superpowers-telemetry-"));
  roots.add(cwd);
  return cwd;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  roots.clear();
});

describe("subagent telemetry", () => {
  test("builds a structured telemetry record", () => {
    expect(
      buildTelemetryRecord({
        cwd: "/repo",
        agent: "implementer",
        task: "Implement auth retry handling",
        suggestedGrade: "standard",
        finalGrade: "heavy",
        selectedModel: "gpt-5-mini",
        requestedModel: undefined,
        fallbackReason: "gpt-5-mini unavailable",
        selectionReason: "fallback to next eligible model after gpt-5-mini",
        exitCode: 0,
        durationMs: 1234,
        retries: 1,
        reviewRejections: 0,
        usage: { input: 10, output: 20, cacheRead: 1, cacheWrite: 0, cost: 0.12, contextTokens: 30, turns: 2 },
      }),
    ).toMatchObject({
      cwd: "/repo",
      agent: "implementer",
      suggestedGrade: "standard",
      finalGrade: "heavy",
      selectedModel: "gpt-5-mini",
      overrideUsed: false,
      fallbackReason: "gpt-5-mini unavailable",
      success: true,
      durationMs: 1234,
      retries: 1,
      reviewRejections: 0,
      usage: { input: 10, output: 20, cost: 0.12 },
    });
  });

  test("uses a deterministic local-first telemetry path", () => {
    const cwd = createTempCwd();
    expect(getTelemetryFilePath(cwd)).toBe(path.join(cwd, ".pi", "subagent", "telemetry.jsonl"));
  });

  test("appends telemetry records to local storage", () => {
    const cwd = createTempCwd();
    const record = buildTelemetryRecord({
      cwd,
      agent: "implementer",
      task: "Implement auth retry handling",
      suggestedGrade: "standard",
      finalGrade: "standard",
      selectedModel: "gpt-5-mini",
      requestedModel: undefined,
      fallbackReason: undefined,
      selectionReason: "lowest-cost eligible available model",
      exitCode: 0,
      durationMs: 250,
      retries: 0,
      reviewRejections: 0,
      usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0.01, contextTokens: 3, turns: 1 },
    });

    appendTelemetryRecord(cwd, record);

    const lines = fs.readFileSync(getTelemetryFilePath(cwd), "utf-8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ selectedModel: "gpt-5-mini", success: true });
  });

  test("swallows write failures without throwing", () => {
    const cwd = createTempCwd();
    const record = buildTelemetryRecord({
      cwd,
      agent: "implementer",
      task: "Implement auth retry handling",
      suggestedGrade: "standard",
      finalGrade: "standard",
      selectedModel: "gpt-5-mini",
      requestedModel: undefined,
      fallbackReason: undefined,
      selectionReason: "lowest-cost eligible available model",
      exitCode: 0,
      durationMs: 250,
      retries: 0,
      reviewRejections: 0,
      usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0.01, contextTokens: 3, turns: 1 },
    });

    expect(() =>
      appendTelemetryRecord(cwd, record, () => {
        throw new Error("disk full");
      }),
    ).not.toThrow();
  });
});
