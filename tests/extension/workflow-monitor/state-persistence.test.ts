import { describe, expect, test } from "vitest";
import { DebugMonitor } from "../../../extensions/workflow-monitor/debug-monitor";
import { VerificationMonitor } from "../../../extensions/workflow-monitor/verification-monitor";

describe("DebugMonitor state persistence", () => {
  test("getState returns serializable monitor state", () => {
    const monitor = new DebugMonitor();

    monitor.onTestFailed();
    monitor.onInvestigation();
    monitor.onSourceWritten("src/foo.ts");
    monitor.onTestFailed(); // fixAttempts = 1
    monitor.onInvestigation();

    expect(monitor.getState()).toEqual({
      active: true,
      investigated: true,
      fixAttempts: 1,
    });
  });

  test("setState restores monitor state fields", () => {
    const monitor = new DebugMonitor();

    monitor.setState({ active: true, investigated: false, fixAttempts: 3 });

    expect(monitor.isActive()).toBe(true);
    expect(monitor.hasInvestigated()).toBe(false);
    expect(monitor.getFixAttempts()).toBe(3);
  });

  test("setState does not persist sourceWrittenSinceLastTest", () => {
    const monitor = new DebugMonitor();

    monitor.setState({ active: true, investigated: false, fixAttempts: 2 });
    monitor.onTestFailed();

    expect(monitor.getFixAttempts()).toBe(2);
  });
});

describe("VerificationMonitor state persistence", () => {
  test("getState returns serializable monitor state", () => {
    const monitor = new VerificationMonitor();

    monitor.recordVerification();
    monitor.recordVerificationWaiver();

    expect(monitor.getState()).toEqual({
      verified: true,
      verificationWaived: true,
    });
  });

  test("setState restores monitor state fields", () => {
    const monitor = new VerificationMonitor();

    monitor.setState({ verified: false, verificationWaived: true });

    expect(monitor.hasRecentVerification()).toBe(false);
    expect(monitor.checkCommitGate("git commit -m 'x'")).toBeNull();
  });
});
