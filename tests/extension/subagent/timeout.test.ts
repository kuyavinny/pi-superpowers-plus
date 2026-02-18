import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { getSubagentTimeoutMs, DEFAULT_SUBAGENT_TIMEOUT_MS } from "../../../extensions/subagent/timeout.js";

describe("getSubagentTimeoutMs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns default when no env or agent override", () => {
    delete process.env.PI_SUBAGENT_TIMEOUT_MS;
    expect(getSubagentTimeoutMs()).toBe(DEFAULT_SUBAGENT_TIMEOUT_MS);
  });

  test("reads from PI_SUBAGENT_TIMEOUT_MS env var", () => {
    process.env.PI_SUBAGENT_TIMEOUT_MS = "300000";
    expect(getSubagentTimeoutMs()).toBe(300000);
  });

  test("agent timeout overrides env var", () => {
    process.env.PI_SUBAGENT_TIMEOUT_MS = "300000";
    expect(getSubagentTimeoutMs(120000)).toBe(120000);
  });

  test("ignores invalid env values and falls back to default", () => {
    process.env.PI_SUBAGENT_TIMEOUT_MS = "not-a-number";
    expect(getSubagentTimeoutMs()).toBe(DEFAULT_SUBAGENT_TIMEOUT_MS);
  });

  test("ignores zero or negative env values", () => {
    process.env.PI_SUBAGENT_TIMEOUT_MS = "0";
    expect(getSubagentTimeoutMs()).toBe(DEFAULT_SUBAGENT_TIMEOUT_MS);
    process.env.PI_SUBAGENT_TIMEOUT_MS = "-1000";
    expect(getSubagentTimeoutMs()).toBe(DEFAULT_SUBAGENT_TIMEOUT_MS);
  });
});
