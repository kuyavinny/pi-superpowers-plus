import { describe, test, expect } from "vitest";
import workflowMonitorExtension from "../../../extensions/workflow-monitor";

type Handler = (event: any, ctx: any) => any;

function createFakePi() {
  const handlers = new Map<string, Handler[]>();
  return {
    handlers,
    api: {
      on(event: string, handler: Handler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerTool() {},
      registerCommand() {},
      appendEntry() {},
    },
  };
}

function getSingleHandler(handlers: Map<string, Handler[]>, event: string): Handler {
  const list = handlers.get(event) ?? [];
  expect(list.length).toBeGreaterThan(0);
  return list[0]!;
}

describe("escalation allow-for-session", () => {
  test("'allow all for this session' bypasses future escalation for same bucket", async () => {
    const fake = createFakePi();
    workflowMonitorExtension(fake.api as any);

    const onToolCall = getSingleHandler(fake.handlers, "tool_call");

    let promptCount = 0;
    const ctx = {
      hasUI: true,
      sessionManager: { getBranch: () => [] },
      ui: {
        setWidget: () => {},
        select: async () => {
          promptCount += 1;
          return "Yes, allow all for this session";
        },
        setEditorText: () => {},
        notify: () => {},
      },
    };

    // 1st violation: no prompt (strike 1)
    await onToolCall({ toolCallId: "t1", toolName: "write", input: { path: "src/a.ts", content: "x" } }, ctx);
    expect(promptCount).toBe(0);

    // 2nd violation: triggers prompt, user picks "allow all for this session"
    await onToolCall({ toolCallId: "t2", toolName: "write", input: { path: "src/b.ts", content: "y" } }, ctx);
    expect(promptCount).toBe(1);

    // 3rd and 4th violations: no more prompts for this bucket
    await onToolCall({ toolCallId: "t3", toolName: "write", input: { path: "src/c.ts", content: "z" } }, ctx);
    await onToolCall({ toolCallId: "t4", toolName: "write", input: { path: "src/d.ts", content: "w" } }, ctx);
    expect(promptCount).toBe(1); // still only 1 prompt total
  });

  test("session_switch resets session-allowed flags", async () => {
    const fake = createFakePi();
    workflowMonitorExtension(fake.api as any);

    const onSessionSwitch = getSingleHandler(fake.handlers, "session_switch");
    const onToolCall = getSingleHandler(fake.handlers, "tool_call");

    let promptCount = 0;
    const selectResponses: string[] = [];
    const ctx = {
      hasUI: true,
      sessionManager: { getBranch: () => [] },
      ui: {
        setWidget: () => {},
        select: async () => {
          promptCount += 1;
          return selectResponses.shift() ?? "Yes, continue";
        },
        setEditorText: () => {},
        notify: () => {},
      },
    };

    // Allow all for session
    selectResponses.push("Yes, allow all for this session");
    await onToolCall({ toolCallId: "t1", toolName: "write", input: { path: "src/a.ts", content: "x" } }, ctx);
    await onToolCall({ toolCallId: "t2", toolName: "write", input: { path: "src/b.ts", content: "y" } }, ctx);
    expect(promptCount).toBe(1);

    // Switch session — should reset
    await onSessionSwitch({}, ctx);

    // Now 2 more violations should prompt again
    promptCount = 0;
    selectResponses.push("Yes, continue");
    await onToolCall({ toolCallId: "t3", toolName: "write", input: { path: "src/c.ts", content: "z" } }, ctx);
    await onToolCall({ toolCallId: "t4", toolName: "write", input: { path: "src/d.ts", content: "w" } }, ctx);
    expect(promptCount).toBe(1); // prompted again after reset
  });
});
