import { beforeEach, describe, expect, test } from "vitest";
import { DebugMonitor } from "../../../extensions/workflow-monitor/debug-monitor";

describe("DebugMonitor", () => {
  let monitor: DebugMonitor;

  beforeEach(() => {
    monitor = new DebugMonitor();
  });

  // --- Activation ---

  test("starts inactive", () => {
    expect(monitor.isActive()).toBe(false);
  });

  test("activates on test failure", () => {
    monitor.onTestFailed();
    expect(monitor.isActive()).toBe(true);
  });

  test("does not activate on test pass", () => {
    monitor.onTestPassed();
    expect(monitor.isActive()).toBe(false);
  });

  // --- Investigation tracking ---

  test("starts without investigation", () => {
    monitor.onTestFailed();
    expect(monitor.hasInvestigated()).toBe(false);
  });

  test("marks investigated on file read", () => {
    monitor.onTestFailed();
    monitor.onInvestigation();
    expect(monitor.hasInvestigated()).toBe(true);
  });

  test("investigation resets after fix-fail cycle", () => {
    monitor.onTestFailed();
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // failed fix
    expect(monitor.hasInvestigated()).toBe(false);
  });

  // --- Fix attempt counting ---

  test("starts with 0 fix attempts", () => {
    expect(monitor.getFixAttempts()).toBe(0);
  });

  test("increments fix attempts on source-write then test-fail cycle", () => {
    monitor.onTestFailed(); // initial failure
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // fix attempt failed
    expect(monitor.getFixAttempts()).toBe(1);
  });

  test("does not increment without source write", () => {
    monitor.onTestFailed();
    monitor.onTestFailed(); // no source edit between failures
    expect(monitor.getFixAttempts()).toBe(0);
  });

  test("tracks multiple fix attempts", () => {
    monitor.onTestFailed();
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // attempt 1
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // attempt 2
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // attempt 3
    expect(monitor.getFixAttempts()).toBe(3);
  });

  // --- Violation detection ---

  test("returns fix-without-investigation violation", () => {
    monitor.onTestFailed();
    const violation = monitor.onSourceWritten("src/foo.ts");
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe("fix-without-investigation");
  });

  test("no violation when investigated first", () => {
    monitor.onTestFailed();
    monitor.onInvestigation();
    const violation = monitor.onSourceWritten("src/foo.ts");
    expect(violation).toBeNull();
  });

  test("returns excessive-fix-attempts violation at 3+", () => {
    monitor.onTestFailed();
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // 1
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // 2
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // 3
    monitor.onInvestigation();
    const violation = monitor.onSourceWritten("src/bar.ts");
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe("excessive-fix-attempts");
  });

  test("no violation when not active", () => {
    const violation = monitor.onSourceWritten("src/foo.ts");
    expect(violation).toBeNull();
  });

  // --- Reset ---

  test("resets on test pass", () => {
    monitor.onTestFailed();
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // attempt 1
    monitor.onTestPassed();
    expect(monitor.isActive()).toBe(false);
    expect(monitor.getFixAttempts()).toBe(0);
  });

  test("resets on commit", () => {
    monitor.onTestFailed();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onCommit();
    expect(monitor.isActive()).toBe(false);
    expect(monitor.getFixAttempts()).toBe(0);
  });
});
