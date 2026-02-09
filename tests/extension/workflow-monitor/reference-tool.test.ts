import { describe, test, expect } from "vitest";
import { loadReference, REFERENCE_TOPICS } from "../../../extensions/workflow-monitor/reference-tool";

describe("REFERENCE_TOPICS", () => {
  test("includes tdd topics", () => {
    expect(REFERENCE_TOPICS).toContain("tdd-rationalizations");
    expect(REFERENCE_TOPICS).toContain("tdd-examples");
    expect(REFERENCE_TOPICS).toContain("tdd-when-stuck");
    expect(REFERENCE_TOPICS).toContain("tdd-anti-patterns");
  });
});

describe("loadReference", () => {
  test("loads tdd-rationalizations", async () => {
    const content = await loadReference("tdd-rationalizations");
    expect(content).toContain("Rationalizations");
    expect(content).toContain("Too simple to test");
  });

  test("loads tdd-anti-patterns (existing file)", async () => {
    const content = await loadReference("tdd-anti-patterns");
    expect(content).toContain("Anti-Pattern");
  });

  test("loads tdd-examples", async () => {
    const content = await loadReference("tdd-examples");
    expect(content).toContain("retryOperation");
  });

  test("loads tdd-when-stuck", async () => {
    const content = await loadReference("tdd-when-stuck");
    expect(content).toContain("When Stuck");
  });

  test("returns error for unknown topic", async () => {
    const content = await loadReference("nonexistent-topic");
    expect(content).toContain("Unknown topic");
  });
});
