import { describe, expect, test } from "vitest";
import { DebugMonitor } from "../../../extensions/workflow-monitor/debug-monitor";
import { VerificationMonitor } from "../../../extensions/workflow-monitor/verification-monitor";
import {
  createWorkflowHandler,
  type SuperpowersStateSnapshot,
} from "../../../extensions/workflow-monitor/workflow-handler";
import { WorkflowTracker } from "../../../extensions/workflow-monitor/workflow-tracker";

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

describe("WorkflowHandler aggregated state persistence", () => {
  test("getFullState aggregates workflow, tdd, debug, and verification state", () => {
    const handler = createWorkflowHandler();

    handler.handleInputText("/skill:writing-plans");
    handler.handleBashResult("npx vitest run", "FAIL", 1);
    handler.handleBashResult("npx vitest run", "FAIL", 1);
    handler.handleReadOrInvestigation("read", "extensions/workflow-monitor/workflow-handler.ts");
    handler.handleToolCall("edit", { path: "src/foo.ts" });
    handler.handleBashResult("npx vitest run", "FAIL", 1);
    handler.handleReadOrInvestigation("read", "extensions/workflow-monitor/workflow-handler.ts");
    handler.restoreTddState("red", ["tests/foo.test.ts"], ["src/foo.ts"], false);
    handler.recordVerificationWaiver();

    expect(handler.getFullState()).toEqual({
      workflow: handler.getWorkflowState(),
      tdd: {
        phase: "red",
        testFiles: ["tests/foo.test.ts"],
        sourceFiles: ["src/foo.ts"],
        redVerificationPending: false,
      },
      debug: {
        active: true,
        investigated: true,
        fixAttempts: 1,
      },
      verification: {
        verified: false,
        verificationWaived: true,
      },
    });
  });

  test("setFullState distributes state to all subsystems", () => {
    const handler = createWorkflowHandler();
    const snapshot: SuperpowersStateSnapshot = {
      workflow: {
        phases: {
          brainstorm: "complete",
          plan: "active",
          execute: "pending",
          verify: "pending",
          review: "pending",
          finish: "pending",
        },
        currentPhase: "plan",
        artifacts: {
          brainstorm: "docs/plans/2026-02-15-feature-design.md",
          plan: null,
          execute: null,
          verify: null,
          review: null,
          finish: null,
        },
        prompted: {
          brainstorm: true,
          plan: false,
          execute: false,
          verify: false,
          review: false,
          finish: false,
        },
      },
      tdd: {
        phase: "green",
        testFiles: ["tests/a.test.ts"],
        sourceFiles: ["src/a.ts"],
        redVerificationPending: false,
      },
      debug: {
        active: true,
        investigated: false,
        fixAttempts: 2,
      },
      verification: {
        verified: false,
        verificationWaived: true,
      },
    };

    handler.setFullState(snapshot);

    expect(handler.getFullState()).toEqual(snapshot);
    expect(handler.getTddPhase()).toBe("green");
    expect(handler.isDebugActive()).toBe(true);
    expect(handler.getDebugFixAttempts()).toBe(2);
    expect(handler.checkCommitGate("git commit -m 'x'")).toBeNull();
  });

  test("round-trips full state snapshot", () => {
    const source = createWorkflowHandler();

    source.handleInputText("/skill:writing-plans");
    source.restoreTddState("refactor", ["tests/r.test.ts"], ["src/r.ts"], false);
    source.handleBashResult("npx vitest run", "FAIL", 1);
    source.handleBashResult("npx vitest run", "FAIL", 1);
    source.recordVerificationWaiver();

    const snapshot = source.getFullState();

    const target = createWorkflowHandler();
    target.setFullState(snapshot);

    expect(target.getFullState()).toEqual(snapshot);
  });

  test("setFullState tolerates missing sections defensively", () => {
    const handler = createWorkflowHandler();

    expect(() => handler.setFullState({} as SuperpowersStateSnapshot)).not.toThrow();
  });

  test("setFullState merges partial nested fields with defaults", () => {
    const handler = createWorkflowHandler();

    expect(() =>
      handler.setFullState({
        tdd: {
          phase: "red",
        },
        debug: {
          active: true,
        },
        verification: {
          verificationWaived: true,
        },
      }),
    ).not.toThrow();

    expect(handler.getFullState()).toMatchObject({
      tdd: {
        phase: "red",
        testFiles: [],
        sourceFiles: [],
        redVerificationPending: false,
      },
      debug: {
        active: true,
        investigated: false,
        fixAttempts: 0,
      },
      verification: {
        verified: false,
        verificationWaived: true,
      },
    });
  });

  test("handleSkillFileRead delegates to workflow tracker", () => {
    const handler = createWorkflowHandler();

    const changed = handler.handleSkillFileRead("/home/pi/workspace/pi-superpowers-plus/skills/writing-plans/SKILL.md");

    expect(changed).toBe(true);
    expect(handler.getWorkflowState()?.currentPhase).toBe("plan");
  });

  test("resetState restores all subsystems to defaults", () => {
    const handler = createWorkflowHandler();

    handler.handleInputText("/skill:writing-plans");
    handler.restoreTddState("green", ["tests/x.test.ts"], ["src/x.ts"], false);
    handler.setFullState({
      workflow: handler.getWorkflowState()!,
      tdd: {
        phase: "green",
        testFiles: ["tests/x.test.ts"],
        sourceFiles: ["src/x.ts"],
        redVerificationPending: false,
      },
      debug: { active: true, investigated: true, fixAttempts: 3 },
      verification: { verified: true, verificationWaived: true },
    });

    handler.resetState();

    expect(handler.getFullState()).toEqual({
      workflow: new WorkflowTracker().getState(),
      tdd: {
        phase: "idle",
        testFiles: [],
        sourceFiles: [],
        redVerificationPending: false,
      },
      debug: {
        active: false,
        investigated: false,
        fixAttempts: 0,
      },
      verification: {
        verified: false,
        verificationWaived: false,
      },
    });
  });
});
